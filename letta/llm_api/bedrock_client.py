from typing import List, Optional, Union

import anthropic
from aioboto3.session import Session

from letta.llm_api.anthropic_client import AnthropicClient
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.enums import ProviderCategory
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.services.provider_manager import ProviderManager
from letta.settings import model_settings

logger = get_logger(__name__)


class BedrockClient(AnthropicClient):

    @trace_method
    async def _get_anthropic_client_async(
        self, llm_config: LLMConfig, async_client: bool = False
    ) -> Union[anthropic.AsyncAnthropic, anthropic.Anthropic, anthropic.AsyncAnthropicBedrock, anthropic.AnthropicBedrock]:
        override_access_key_id, override_secret_access_key, override_default_region = None, None, None
        if llm_config.provider_category == ProviderCategory.byok:
            (
                override_access_key_id,
                override_secret_access_key,
                override_default_region,
            ) = await ProviderManager().get_bedrock_credentials_async(
                llm_config.provider_name,
                actor=self.actor,
            )

        session = Session()
        async with session.client(
            "sts",
            aws_access_key_id=override_access_key_id or model_settings.aws_access_key_id,
            aws_secret_access_key=override_secret_access_key or model_settings.aws_secret_access_key,
            region_name=override_default_region or model_settings.aws_default_region,
        ) as sts_client:
            session_token = await sts_client.get_session_token()
            credentials = session_token["Credentials"]

        if async_client:
            return anthropic.AsyncAnthropicBedrock(
                aws_access_key=credentials["AccessKeyId"],
                aws_secret_key=credentials["SecretAccessKey"],
                aws_session_token=credentials["SessionToken"],
                aws_region=override_default_region or model_settings.aws_default_region,
                max_retries=model_settings.anthropic_max_retries,
            )
        else:
            return anthropic.AnthropicBedrock(
                aws_access_key=credentials["AccessKeyId"],
                aws_secret_key=credentials["SecretAccessKey"],
                aws_session_token=credentials["SessionToken"],
                aws_region=override_default_region or model_settings.aws_default_region,
                max_retries=model_settings.anthropic_max_retries,
            )

    @trace_method
    def build_request_data(
        self,
        messages: List[PydanticMessage],
        llm_config: LLMConfig,
        tools: Optional[List[dict]] = None,
        force_tool_call: Optional[str] = None,
    ) -> dict:
        data = super().build_request_data(messages, llm_config, tools, force_tool_call)
        # remove disallowed fields
        if "tool_choice" in data:
            del data["tool_choice"]["disable_parallel_tool_use"]
        return data
