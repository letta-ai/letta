from typing import Dict

LLM_HANDLE_OVERRIDES: Dict[str, Dict[str, str]] = {
    "anthropic": {
        "claude-3-5-haiku-20241022": "claude-3-5-haiku",
        "claude-3-5-sonnet-20241022": "claude-3-5-sonnet",
        "claude-3-opus-20240229": "claude-3-opus",
    },
    "openai": {
        "chatgpt-4o-latest": "chatgpt-4o",
        "gpt-3.5-turbo": "gpt-3.5-turbo",
        "gpt-3.5-turbo-0125": "gpt-3.5-turbo-jan",
        "gpt-3.5-turbo-1106": "gpt-3.5-turbo-nov",
        "gpt-3.5-turbo-16k": "gpt-3.5-turbo-16k",
        "gpt-3.5-turbo-instruct": "gpt-3.5-turbo-instruct",
        "gpt-4-0125-preview": "gpt-4-preview-jan",
        "gpt-4-0613": "gpt-4-june",
        "gpt-4-1106-preview": "gpt-4-preview-nov",
        "gpt-4-turbo-2024-04-09": "gpt-4-turbo-apr",
        "gpt-4o-2024-05-13": "gpt-4o-may",
        "gpt-4o-2024-08-06": "gpt-4o-aug",
        "gpt-4o-mini-2024-07-18": "gpt-4o-mini-jul",
    },
    "together": {
        "Qwen/Qwen2.5-72B-Instruct-Turbo": "qwen-2.5-72b-instruct",
        "meta-llama/Llama-3-70b-chat-hf": "llama-3-70b",
        "meta-llama/Meta-Llama-3-70B-Instruct-Turbo": "llama-3-70b-instruct",
        "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo": "llama-3.1-405b-instruct",
        "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": "llama-3.1-70b-instruct",
        "meta-llama/Llama-3.3-70B-Instruct-Turbo": "llama-3.3-70b-instruct",
        "mistralai/Mistral-7B-Instruct-v0.2": "mistral-7b-instruct-v2",
        "mistralai/Mistral-7B-Instruct-v0.3": "mistral-7b-instruct-v3",
        "mistralai/Mixtral-8x22B-Instruct-v0.1": "mixtral-8x22b-instruct",
        "mistralai/Mixtral-8x7B-Instruct-v0.1": "mixtral-8x7b-instruct",
        "mistralai/Mixtral-8x7B-v0.1": "mixtral-8x7b",
        "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO": "hermes-2-mixtral",
    },
}
