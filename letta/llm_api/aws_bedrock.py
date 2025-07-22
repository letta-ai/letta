"""
Note that this formally only supports Anthropic Bedrock.
TODO (cliandy): determine what other providers are supported and what is needed to add support.
"""

import os
from typing import Any, Optional

from anthropic import AnthropicBedrock

from letta.log import get_logger
from letta.settings import model_settings

logger = get_logger(__name__)


def has_valid_aws_credentials() -> bool:
    """
    Check if AWS credentials are properly configured.
    """
    return all(
        (
            os.getenv("AWS_ACCESS_KEY_ID"),
            os.getenv("AWS_SECRET_ACCESS_KEY"),
            os.getenv("AWS_DEFAULT_REGION"),
        )
    )


def get_bedrock_client(
    access_key_id: Optional[str] = None,
    secret_key: Optional[str] = None,
    default_region: Optional[str] = None,
):
    """
    Get a Bedrock client
    """
    import boto3

    sts_client = boto3.client(
        "sts",
        aws_access_key_id=access_key_id or model_settings.aws_access_key_id,
        aws_secret_access_key=secret_key or model_settings.aws_secret_access_key,
        region_name=default_region or model_settings.aws_default_region,
    )
    credentials = sts_client.get_session_token()["Credentials"]

    bedrock = AnthropicBedrock(
        aws_access_key=credentials["AccessKeyId"],
        aws_secret_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
        aws_region=default_region or model_settings.aws_default_region,
    )
    return bedrock


async def bedrock_get_model_list_async(
    access_key_id: Optional[str] = None,
    secret_access_key: Optional[str] = None,
    default_region: Optional[str] = None,
) -> list[dict]:
    from aioboto3.session import Session

    try:
        session = Session()
        async with session.client(
            "bedrock",
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=default_region,
        ) as bedrock:
            response = await bedrock.list_inference_profiles()
            return response["inferenceProfileSummaries"]
    except Exception as e:
        logger.error(f"Error getting model list for bedrock: %s", e)
        raise e


def bedrock_get_model_details(region_name: str, model_id: str) -> dict[str, Any]:
    """
    Get details for a specific model from Bedrock.
    """
    import boto3
    from botocore.exceptions import ClientError

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
    # 200k for anthropic: https://aws.amazon.com/bedrock/anthropic/
    if model_id.startswith("anthropic"):
        return 200_000
    else:
        return 100_000  # default to 100k if unknown
