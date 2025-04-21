from models.llm_backend import LLMBackendConfig
from models.chat_completion_request import ChatCompletionRequest
from letta.schemas.llm_config import LLMConfig

def route_llm_request(request: ChatCompletionRequest) -> LLMBackendConfig:
    """FIXME just a dummy policy, just do gpt-4 @ openai"""
    # TODO: modify this to use LLMConfig instead
    print("running request", request.model)
    if request.model == "memgpt-vllm":
        # TODO this proxy server should be hosted @ api.memgpt.ai, so model_endpoint should likely be an IP address
        config = LLMConfig(
            model="ehartford/dolphin-2.5-mixtral-8x7b",
            context_window=16384,
            model_wrapper="chatml",
            model_endpoint="https://api.memgpt.ai",
            model_endpoint_type="vllm",
        )
    elif request.model == "memgpt-openai" or request.model == "memgpt":
        # TODO just an example: if the user passes in "memgpt-openai", they get gpt-4
        config = LLMConfig(
            model="gpt-4o-mini",
            context_window=128000,
            model_wrapper=None,
            model_endpoint="https://api.openai.com/v1",
            model_endpoint_type="openai",
        )
    else:
        # The default configuration (if the client passes in model==None or unknown)
        # TODO just an example where the default is vLLM
        raise ValueError(f"Unknown model: {request.model}")
    return config
