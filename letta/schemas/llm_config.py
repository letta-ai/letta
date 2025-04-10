from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from letta.log import get_logger

logger = get_logger(__name__)


class LLMConfig(BaseModel):
    """
    Configuration for a Language Model (LLM) model. This object specifies all the information necessary to access an LLM model to usage with Letta, except for secret keys.

    Attributes:
        model (str): The name of the LLM model.
        model_endpoint_type (str): The endpoint type for the model.
        model_endpoint (str): The endpoint for the model.
        model_wrapper (str): The wrapper for the model. This is used to wrap additional text around the input/output of the model. This is useful for text-to-text completions, such as the Completions API in OpenAI.
        context_window (int): The context window size for the model.
        put_inner_thoughts_in_kwargs (bool): Puts `inner_thoughts` as a kwarg in the function call if this is set to True. This helps with function calling performance and also the generation of inner thoughts.
        temperature (float): The temperature to use when generating text with the model. A higher temperature will result in more random text.
        max_tokens (int): The maximum number of tokens to generate.
    """

    # TODO: 🤮 don't default to a vendor! bug city!
    model: str = Field(..., description="LLM model name. ")
    model_endpoint_type: Literal[
        "openai",
        "anthropic",
        "cohere",
        "google_ai",
        "google_vertex",
        "azure",
        "groq",
        "ollama",
        "webui",
        "webui-legacy",
        "lmstudio",
        "lmstudio-legacy",
        "lmstudio-chatcompletions",
        "llamacpp",
        "koboldcpp",
        "vllm",
        "hugging-face",
        "mistral",
        "together",  # completions endpoint
        "bedrock",
        "deepseek",
        "xai",
    ] = Field(..., description="The endpoint type for the model.")
    model_endpoint: Optional[str] = Field(None, description="The endpoint for the model.")
    model_wrapper: Optional[str] = Field(None, description="The wrapper for the model.")
    context_window: int = Field(..., description="The context window size for the model.")
    put_inner_thoughts_in_kwargs: Optional[bool] = Field(
        True,
        description="Puts 'inner_thoughts' as a kwarg in the function call if this is set to True. This helps with function calling performance and also the generation of inner thoughts.",
    )
    handle: Optional[str] = Field(None, description="The handle for this config, in the format provider/model-name.")
    temperature: float = Field(
        0.7,
        description="The temperature to use when generating text with the model. A higher temperature will result in more random text.",
    )
    max_tokens: Optional[int] = Field(
        4096,
        description="The maximum number of tokens to generate. If not set, the model will use its default value.",
    )
    enable_reasoner: bool = Field(
        False, description="Whether or not the model should use extended thinking if it is a 'reasoning' style model"
    )
    max_reasoning_tokens: int = Field(
        0, description="Configurable thinking budget for extended thinking, only used if enable_reasoner is True. Minimum value is 1024."
    )

    # FIXME hack to silence pydantic protected namespace warning
    model_config = ConfigDict(protected_namespaces=())

    @model_validator(mode="before")
    @classmethod
    def set_default_enable_reasoner(cls, values):
        if any(openai_reasoner_model in values.get("model", "") for openai_reasoner_model in ["o3-mini", "o1"]):
            values["enable_reasoner"] = True
        return values

    @model_validator(mode="before")
    @classmethod
    def set_default_put_inner_thoughts(cls, values):
        """
        Dynamically set the default for put_inner_thoughts_in_kwargs based on the model field,
        falling back to True if no specific rule is defined.
        """
        model = values.get("model")

        # Define models where we want put_inner_thoughts_in_kwargs to be False
        avoid_put_inner_thoughts_in_kwargs = ["gpt-4"]

        if values.get("put_inner_thoughts_in_kwargs") is None:
            values["put_inner_thoughts_in_kwargs"] = False if model in avoid_put_inner_thoughts_in_kwargs else True

        return values

    @model_validator(mode="after")
    def issue_warning_for_reasoning_constraints(self) -> "LLMConfig":
        if self.enable_reasoner:
            if self.max_reasoning_tokens is None:
                logger.warning("max_reasoning_tokens must be set when enable_reasoner is True")
            if self.max_tokens is not None and self.max_reasoning_tokens >= self.max_tokens:
                logger.warning("max_tokens must be greater than max_reasoning_tokens (thinking budget)")
            if self.put_inner_thoughts_in_kwargs:
                logger.warning("Extended thinking is not compatible with put_inner_thoughts_in_kwargs")
        elif self.max_reasoning_tokens and not self.enable_reasoner:
            logger.warning("model will not use reasoning unless enable_reasoner is set to True")

        return self

    @classmethod
    def default_config(cls, model_name: str):
        """
        Convinience function to generate a default `LLMConfig` from a model name. Only some models are supported in this function.

        Args:
            model_name (str): The name of the model (gpt-4, gpt-4o-mini, letta).
        """
        if model_name == "gpt-4":
            return cls(
                model="gpt-4",
                model_endpoint_type="openai",
                model_endpoint="https://api.openai.com/v1",
                model_wrapper=None,
                context_window=8192,
                put_inner_thoughts_in_kwargs=True,
            )
        elif model_name == "gpt-4o-mini":
            return cls(
                model="gpt-4o-mini",
                model_endpoint_type="openai",
                model_endpoint="https://api.openai.com/v1",
                model_wrapper=None,
                context_window=128000,
            )
        elif model_name == "gpt-4o":
            return cls(
                model="gpt-4o",
                model_endpoint_type="openai",
                model_endpoint="https://api.openai.com/v1",
                model_wrapper=None,
                context_window=128000,
            )
        elif model_name == "letta":
            return cls(
                model="memgpt-openai",
                model_endpoint_type="openai",
                model_endpoint="https://inference.memgpt.ai",
                context_window=8192,
            )
        else:
            raise ValueError(f"Model {model_name} not supported.")

    def pretty_print(self) -> str:
        return (
            f"{self.model}"
            + (f" [type={self.model_endpoint_type}]" if self.model_endpoint_type else "")
            + (f" [ip={self.model_endpoint}]" if self.model_endpoint else "")
        )
