from collections import defaultdict

import requests
from openai import AzureOpenAI


def get_azure_chat_completions_endpoint(base_url: str, model: str, api_version: str):
    return f"{base_url}/openai/deployments/{model}/chat/completions?api-version={api_version}"


def get_azure_embeddings_endpoint(base_url: str, model: str, api_version: str):
    return f"{base_url}/openai/deployments/{model}/embeddings?api-version={api_version}"


def get_azure_model_list_endpoint(base_url: str, api_version: str):
    return f"{base_url}/openai/models?api-version={api_version}"


def get_azure_deployment_list_endpoint(base_url: str):
    # Please note that it has to be 2023-03-15-preview
    # That's the only api version that works with this deployments endpoint
    # TODO: Use the Azure Client library here instead
    return f"{base_url}/openai/deployments?api-version=2023-03-15-preview"


def azure_openai_get_deployed_model_list(base_url: str, api_key: str, api_version: str) -> list:
    """https://learn.microsoft.com/en-us/rest/api/azureopenai/models/list?view=rest-azureopenai-2023-05-15&tabs=HTTP"""

    client = AzureOpenAI(api_key=api_key, api_version=api_version, azure_endpoint=base_url)

    try:
        models_list = client.models.list()
    except Exception:
        return []

    all_available_models = [model.to_dict() for model in models_list.data]

    # https://xxx.openai.azure.com/openai/models?api-version=xxx
    headers = {"Content-Type": "application/json"}
    if api_key is not None:
        headers["api-key"] = f"{api_key}"

    # 2. Get all the deployed models
    url = get_azure_deployment_list_endpoint(base_url)
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
    except requests.RequestException as e:
        raise RuntimeError(f"Failed to retrieve model list: {e}")

    deployed_models = response.json().get("data", [])
    deployed_model_names = set([m["id"] for m in deployed_models])

    # 3. Only return the models in available models if they have been deployed
    deployed_models = [m for m in all_available_models if m["id"] in deployed_model_names]

    # 4. Remove redundant deployments, only include the ones with the latest deployment
    # Create a dictionary to store the latest model for each ID
    latest_models = defaultdict()

    # Iterate through the models and update the dictionary with the most recent model
    for model in deployed_models:
        model_id = model["id"]
        updated_at = model["created_at"]

        # If the model ID is new or the current model has a more recent created_at, update the dictionary
        if model_id not in latest_models or updated_at > latest_models[model_id]["created_at"]:
            latest_models[model_id] = model

    # Extract the unique models
    return list(latest_models.values())


def azure_openai_get_chat_completion_model_list(base_url: str, api_key: str, api_version: str) -> list:
    model_list = azure_openai_get_deployed_model_list(base_url, api_key, api_version)
    # Extract models that support text generation
    model_options = [m for m in model_list if m.get("capabilities").get("chat_completion") == True]
    return model_options


def azure_openai_get_embeddings_model_list(base_url: str, api_key: str, api_version: str, require_embedding_in_name: bool = True) -> list:
    def valid_embedding_model(m: dict):
        valid_name = True
        if require_embedding_in_name:
            valid_name = "embedding" in m["id"]

        return m.get("capabilities").get("embeddings") == True and valid_name

    model_list = azure_openai_get_deployed_model_list(base_url, api_key, api_version)
    # Extract models that support embeddings

    model_options = [m for m in model_list if valid_embedding_model(m)]

    return model_options
