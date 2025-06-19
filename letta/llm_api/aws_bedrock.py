import os
from typing import Any, Dict, List, Optional

from anthropic import AnthropicBedrock

from letta.log import get_logger
from letta.settings import model_settings

logger = get_logger(__name__)


def has_valid_aws_credentials() -> bool:
    """
    Check if AWS credentials are properly configured.
    """
    valid_aws_credentials = (
        os.getenv("AWS_ACCESS_KEY") is not None and os.getenv("AWS_SECRET_ACCESS_KEY") is not None and os.getenv("AWS_REGION") is not None
    )
    return valid_aws_credentials


def get_bedrock_client(
    access_key: Optional[str] = None,
    secret_key: Optional[str] = None,
    region: Optional[str] = None,
):
    """
    Get a Bedrock client
    """
    import boto3

    logger.debug(f"Getting Bedrock client for {model_settings.aws_region}")
    sts_client = boto3.client(
        "sts",
        aws_access_key_id=access_key or model_settings.aws_access_key,
        aws_secret_access_key=secret_key or model_settings.aws_secret_access_key,
        region_name=region or model_settings.aws_region,
    )
    credentials = sts_client.get_session_token()["Credentials"]

    bedrock = AnthropicBedrock(
        aws_access_key=credentials["AccessKeyId"],
        aws_secret_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
        aws_region=region or model_settings.aws_region,
    )
    return bedrock


def bedrock_get_model_list(region_name: str) -> List[dict]:
    """
    Get list of available models from Bedrock.

    Args:
        region_name: AWS region name
        model_provider: Optional provider name to filter models. If None, returns all models.
        output_modality: Output modality to filter models. Defaults to "text".

    Returns:
        List of model summaries
    """
    import boto3

    logger.debug(f"Getting model list for {region_name}")
    try:
        bedrock = boto3.client("bedrock", region_name=region_name)
        response = bedrock.list_inference_profiles()
        return response["inferenceProfileSummaries"]
    except Exception as e:
        logger.exception(f"Error getting model list: {str(e)}", e)
        raise e


def bedrock_get_model_details(region_name: str, model_id: str) -> Dict[str, Any]:
    """
    Get details for a specific model from Bedrock.
    """
    import boto3
    from botocore.exceptions import ClientError

    logger.debug(f"Getting model details for {model_id}")
    try:
        bedrock = boto3.client("bedrock", region_name=region_name)
        response = bedrock.get_foundation_model(modelIdentifier=model_id)
        return response["modelDetails"]
    except ClientError as e:
        logger.exception(f"Error getting model details: {str(e)}")
        raise e


def bedrock_get_model_context_window(model_id: str) -> int:
    """
    Get context window size for a specific model.
    """
    # Bedrock doesn't provide this via API, so we maintain a mapping
    context_windows = {
        "anthropic.claude-3-5-sonnet-20241022-v2:0": 200000,
        "anthropic.claude-3-5-sonnet-20240620-v1:0": 200000,
        "anthropic.claude-3-5-haiku-20241022-v1:0": 200000,
        "anthropic.claude-3-haiku-20240307-v1:0": 200000,
        "anthropic.claude-3-opus-20240229-v1:0": 200000,
        "anthropic.claude-3-sonnet-20240229-v1:0": 200000,
    }
    return context_windows.get(model_id, 200000)  # default to 100k if unknown


"""
{
    "id": "msg_123",
    "type": "message",
    "role": "assistant",
    "model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "content": [
        {
            "type": "text",
            "text": "I see the Firefox icon. Let me click on it and then navigate to a weather website."
        },
        {
            "type": "tool_use",
            "id": "toolu_123",
            "name": "computer",
            "input": {
                "action": "mouse_move",
                "coordinate": [
                    708,
                    736
                ]
            }
        },
        {
            "type": "tool_use",
            "id": "toolu_234",
            "name": "computer",
            "input": {
                "action": "left_click"
            }
        }
    ],
    "stop_reason": "tool_use",
    "stop_sequence": null,
    "usage": {
        "input_tokens": 3391,
        "output_tokens": 132
    }
}
"""
