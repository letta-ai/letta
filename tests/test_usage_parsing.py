"""
Tests for usage statistics parsing through the production adapter path.

These tests verify that SimpleLLMRequestAdapter correctly extracts usage statistics
from LLM responses, including:
1. Basic usage (prompt_tokens, completion_tokens, total_tokens)
2. Cache-related fields (cached_input_tokens, cache_write_tokens)
3. Reasoning tokens (for models that support it)

This tests the actual production code path:
  SimpleLLMRequestAdapter.invoke_llm()
    → llm_client.request_async_with_telemetry()
    → llm_client.convert_response_to_chat_completion()
    → adapter extracts from chat_completions_response.usage
    → normalize_cache_tokens() / normalize_reasoning_tokens()
"""

import os

import pytest

from letta.adapters.simple_llm_request_adapter import SimpleLLMRequestAdapter
from letta.errors import LLMAuthenticationError
from letta.llm_api.anthropic_client import AnthropicClient
from letta.llm_api.google_ai_client import GoogleAIClient
from letta.llm_api.openai_client import OpenAIClient
from letta.schemas.enums import AgentType, MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message
from letta.settings import model_settings


def _has_openai_credentials() -> bool:
    return bool(model_settings.openai_api_key or os.environ.get("OPENAI_API_KEY"))


def _has_anthropic_credentials() -> bool:
    return bool(model_settings.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY"))


def _has_gemini_credentials() -> bool:
    return bool(model_settings.gemini_api_key or os.environ.get("GEMINI_API_KEY"))


def _build_simple_messages(user_content: str) -> list[Message]:
    """Build a minimal message list for testing."""
    return [
        Message(
            role=MessageRole.user,
            content=[TextContent(text=user_content)],
        )
    ]


# Large system prompt to exceed caching thresholds (>1024 tokens)
LARGE_SYSTEM_PROMPT = """You are an advanced AI assistant with extensive knowledge across multiple domains.

# Core Capabilities

## Technical Knowledge
- Software Engineering: Expert in Python, JavaScript, TypeScript, Go, Rust, and many other languages
- System Design: Deep understanding of distributed systems, microservices, and cloud architecture
- DevOps: Proficient in Docker, Kubernetes, CI/CD pipelines, and infrastructure as code
- Databases: Experience with SQL (PostgreSQL, MySQL) and NoSQL (MongoDB, Redis, Cassandra) databases
- Machine Learning: Knowledge of neural networks, transformers, and modern ML frameworks

## Problem Solving Approach
When tackling problems, you follow a structured methodology:
1. Understand the requirements thoroughly
2. Break down complex problems into manageable components
3. Consider multiple solution approaches
4. Evaluate trade-offs between different options
5. Implement solutions with clean, maintainable code
6. Test thoroughly and iterate based on feedback

## Communication Style
- Clear and concise explanations
- Use examples and analogies when helpful
- Adapt technical depth to the audience
- Ask clarifying questions when requirements are ambiguous
- Provide context and rationale for recommendations

# Domain Expertise

## Web Development
You have deep knowledge of:
- Frontend: React, Vue, Angular, Next.js, modern CSS frameworks
- Backend: Node.js, Express, FastAPI, Django, Flask
- API Design: REST, GraphQL, gRPC
- Authentication: OAuth, JWT, session management
- Performance: Caching strategies, CDNs, lazy loading

## Data Engineering
You understand:
- ETL pipelines and data transformation
- Data warehousing concepts (Snowflake, BigQuery, Redshift)
- Stream processing (Kafka, Kinesis)
- Data modeling and schema design
- Data quality and validation

## Cloud Platforms
You're familiar with:
- AWS: EC2, S3, Lambda, RDS, DynamoDB, CloudFormation
- GCP: Compute Engine, Cloud Storage, Cloud Functions, BigQuery
- Azure: Virtual Machines, Blob Storage, Azure Functions
- Serverless architectures and best practices
- Cost optimization strategies

## Security
You consider:
- Common vulnerabilities (OWASP Top 10)
- Secure coding practices
- Encryption and key management
- Access control and authorization patterns
- Security audit and compliance requirements

# Interaction Principles

## Helpfulness
- Provide actionable guidance
- Share relevant resources and documentation
- Offer multiple approaches when appropriate
- Point out potential pitfalls and edge cases
- Follow up to ensure understanding

## Accuracy
- Acknowledge limitations and uncertainties
- Distinguish between facts and opinions
- Cite sources when making specific claims
- Correct mistakes promptly when identified
- Stay current with latest developments

## Respect
- Value diverse perspectives and approaches
- Maintain professional boundaries
- Protect user privacy and confidentiality
- Avoid assumptions about user background
- Be patient with varying skill levels

Remember: Your goal is to empower users to solve problems and learn, not just to provide answers."""


@pytest.mark.asyncio
async def test_openai_usage_via_adapter():
    """Test OpenAI usage extraction through SimpleLLMRequestAdapter.

    This tests the actual production code path used by letta_agent_v3.
    """
    if not _has_openai_credentials():
        pytest.skip("OpenAI credentials not configured")

    client = OpenAIClient()
    llm_config = LLMConfig.default_config("gpt-4o-mini")

    adapter = SimpleLLMRequestAdapter(
        llm_client=client,
        llm_config=llm_config,
    )

    messages = _build_simple_messages("Say hello in exactly 5 words.")
    request_data = client.build_request_data(AgentType.letta_v1_agent, messages, llm_config)

    # Call through the adapter (production path)
    try:
        async for _ in adapter.invoke_llm(
            request_data=request_data,
            messages=messages,
            tools=[],
            use_assistant_message=False,
        ):
            pass
    except LLMAuthenticationError:
        pytest.skip("OpenAI credentials invalid")

    # Verify usage was extracted
    assert adapter.usage is not None, "adapter.usage should not be None"
    assert adapter.usage.prompt_tokens > 0, f"prompt_tokens should be > 0, got {adapter.usage.prompt_tokens}"
    assert adapter.usage.completion_tokens > 0, f"completion_tokens should be > 0, got {adapter.usage.completion_tokens}"
    assert adapter.usage.total_tokens > 0, f"total_tokens should be > 0, got {adapter.usage.total_tokens}"
    assert adapter.usage.step_count == 1, f"step_count should be 1, got {adapter.usage.step_count}"

    print(f"OpenAI usage: prompt={adapter.usage.prompt_tokens}, completion={adapter.usage.completion_tokens}")
    print(f"OpenAI cache: cached_input={adapter.usage.cached_input_tokens}, cache_write={adapter.usage.cache_write_tokens}")
    print(f"OpenAI reasoning: {adapter.usage.reasoning_tokens}")


@pytest.mark.asyncio
async def test_anthropic_usage_via_adapter():
    """Test Anthropic usage extraction through SimpleLLMRequestAdapter.

    This tests the actual production code path used by letta_agent_v3.

    Note: Anthropic's input_tokens is NON-cached only. The adapter should
    compute total prompt_tokens = input_tokens + cache_read + cache_creation.
    """
    if not _has_anthropic_credentials():
        pytest.skip("Anthropic credentials not configured")

    client = AnthropicClient()
    llm_config = LLMConfig(
        model="claude-3-5-haiku-20241022",
        model_endpoint_type="anthropic",
        model_endpoint="https://api.anthropic.com/v1",
        context_window=200000,
        max_tokens=256,
    )

    adapter = SimpleLLMRequestAdapter(
        llm_client=client,
        llm_config=llm_config,
    )

    # Anthropic requires a system message first
    messages = [
        Message(role=MessageRole.system, content=[TextContent(text="You are a helpful assistant.")]),
        Message(role=MessageRole.user, content=[TextContent(text="Say hello in exactly 5 words.")]),
    ]
    request_data = client.build_request_data(AgentType.letta_v1_agent, messages, llm_config, tools=[])

    # Call through the adapter (production path)
    try:
        async for _ in adapter.invoke_llm(
            request_data=request_data,
            messages=messages,
            tools=[],
            use_assistant_message=False,
        ):
            pass
    except LLMAuthenticationError:
        pytest.skip("Anthropic credentials invalid")

    # Verify usage was extracted
    assert adapter.usage is not None, "adapter.usage should not be None"
    assert adapter.usage.prompt_tokens > 0, f"prompt_tokens should be > 0, got {adapter.usage.prompt_tokens}"
    assert adapter.usage.completion_tokens > 0, f"completion_tokens should be > 0, got {adapter.usage.completion_tokens}"
    assert adapter.usage.total_tokens > 0, f"total_tokens should be > 0, got {adapter.usage.total_tokens}"
    assert adapter.usage.step_count == 1, f"step_count should be 1, got {adapter.usage.step_count}"

    print(f"Anthropic usage: prompt={adapter.usage.prompt_tokens}, completion={adapter.usage.completion_tokens}")
    print(f"Anthropic cache: cached_input={adapter.usage.cached_input_tokens}, cache_write={adapter.usage.cache_write_tokens}")


@pytest.mark.asyncio
async def test_gemini_usage_via_adapter():
    """Test Gemini usage extraction through SimpleLLMRequestAdapter.

    This tests the actual production code path used by letta_agent_v3.
    """
    if not _has_gemini_credentials():
        pytest.skip("Gemini credentials not configured")

    client = GoogleAIClient()
    llm_config = LLMConfig(
        model="gemini-2.0-flash",
        model_endpoint_type="google_ai",
        model_endpoint="https://generativelanguage.googleapis.com",
        context_window=1048576,
        max_tokens=256,
    )

    adapter = SimpleLLMRequestAdapter(
        llm_client=client,
        llm_config=llm_config,
    )

    messages = _build_simple_messages("Say hello in exactly 5 words.")
    request_data = client.build_request_data(AgentType.letta_v1_agent, messages, llm_config, tools=[])

    # Call through the adapter (production path)
    try:
        async for _ in adapter.invoke_llm(
            request_data=request_data,
            messages=messages,
            tools=[],
            use_assistant_message=False,
        ):
            pass
    except LLMAuthenticationError:
        pytest.skip("Gemini credentials invalid")

    # Verify usage was extracted
    assert adapter.usage is not None, "adapter.usage should not be None"
    assert adapter.usage.prompt_tokens > 0, f"prompt_tokens should be > 0, got {adapter.usage.prompt_tokens}"
    assert adapter.usage.completion_tokens > 0, f"completion_tokens should be > 0, got {adapter.usage.completion_tokens}"
    assert adapter.usage.total_tokens > 0, f"total_tokens should be > 0, got {adapter.usage.total_tokens}"
    assert adapter.usage.step_count == 1, f"step_count should be 1, got {adapter.usage.step_count}"

    print(f"Gemini usage: prompt={adapter.usage.prompt_tokens}, completion={adapter.usage.completion_tokens}")
    print(f"Gemini cache: cached_input={adapter.usage.cached_input_tokens}")
    print(f"Gemini reasoning: {adapter.usage.reasoning_tokens}")


@pytest.mark.asyncio
async def test_openai_prefix_caching_via_adapter():
    """Test OpenAI prefix caching through SimpleLLMRequestAdapter.

    Makes two requests with the same large system prompt to verify
    cached_input_tokens is populated on the second request.

    Note: Prefix caching is probabilistic and depends on server-side state.
    """
    if not _has_openai_credentials():
        pytest.skip("OpenAI credentials not configured")

    client = OpenAIClient()
    llm_config = LLMConfig.default_config("gpt-4o-mini")

    # First request - should populate the cache
    adapter1 = SimpleLLMRequestAdapter(llm_client=client, llm_config=llm_config)
    messages1 = [
        Message(role=MessageRole.system, content=[TextContent(text=LARGE_SYSTEM_PROMPT)]),
        Message(role=MessageRole.user, content=[TextContent(text="What is 2+2?")]),
    ]
    request_data1 = client.build_request_data(AgentType.letta_v1_agent, messages1, llm_config)

    try:
        async for _ in adapter1.invoke_llm(request_data=request_data1, messages=messages1, tools=[], use_assistant_message=False):
            pass
    except LLMAuthenticationError:
        pytest.skip("OpenAI credentials invalid")

    print(f"Request 1 - prompt={adapter1.usage.prompt_tokens}, cached={adapter1.usage.cached_input_tokens}")

    # Second request - same system prompt, should hit cache
    adapter2 = SimpleLLMRequestAdapter(llm_client=client, llm_config=llm_config)
    messages2 = [
        Message(role=MessageRole.system, content=[TextContent(text=LARGE_SYSTEM_PROMPT)]),
        Message(role=MessageRole.user, content=[TextContent(text="What is 3+3?")]),
    ]
    request_data2 = client.build_request_data(AgentType.letta_v1_agent, messages2, llm_config)

    async for _ in adapter2.invoke_llm(request_data=request_data2, messages=messages2, tools=[], use_assistant_message=False):
        pass

    print(f"Request 2 - prompt={adapter2.usage.prompt_tokens}, cached={adapter2.usage.cached_input_tokens}")

    # Verify basic usage
    assert adapter2.usage.prompt_tokens > 0
    assert adapter2.usage.completion_tokens > 0

    # Note: We can't guarantee cache hit, but if it happened, cached_input_tokens should be > 0
    if adapter2.usage.cached_input_tokens and adapter2.usage.cached_input_tokens > 0:
        print(f"SUCCESS: OpenAI cache hit! cached_input_tokens={adapter2.usage.cached_input_tokens}")
    else:
        print("INFO: No cache hit (cache may not have been populated yet)")


@pytest.mark.asyncio
async def test_anthropic_prefix_caching_via_adapter():
    """Test Anthropic prefix caching through SimpleLLMRequestAdapter.

    Makes two requests with the same large system prompt using cache_control
    to verify cache tokens are populated.

    Note: Anthropic requires explicit cache_control breakpoints.
    """
    if not _has_anthropic_credentials():
        pytest.skip("Anthropic credentials not configured")

    client = AnthropicClient()
    llm_config = LLMConfig(
        model="claude-3-5-haiku-20241022",
        model_endpoint_type="anthropic",
        model_endpoint="https://api.anthropic.com/v1",
        context_window=200000,
        max_tokens=256,
    )

    # First request
    adapter1 = SimpleLLMRequestAdapter(llm_client=client, llm_config=llm_config)
    messages1 = [
        Message(role=MessageRole.system, content=[TextContent(text=LARGE_SYSTEM_PROMPT)]),
        Message(role=MessageRole.user, content=[TextContent(text="What is 2+2?")]),
    ]
    request_data1 = client.build_request_data(AgentType.letta_v1_agent, messages1, llm_config, tools=[])

    try:
        async for _ in adapter1.invoke_llm(request_data=request_data1, messages=messages1, tools=[], use_assistant_message=False):
            pass
    except LLMAuthenticationError:
        pytest.skip("Anthropic credentials invalid")

    print(
        f"Request 1 - prompt={adapter1.usage.prompt_tokens}, cached={adapter1.usage.cached_input_tokens}, cache_write={adapter1.usage.cache_write_tokens}"
    )

    # Second request
    adapter2 = SimpleLLMRequestAdapter(llm_client=client, llm_config=llm_config)
    messages2 = [
        Message(role=MessageRole.system, content=[TextContent(text=LARGE_SYSTEM_PROMPT)]),
        Message(role=MessageRole.user, content=[TextContent(text="What is 3+3?")]),
    ]
    request_data2 = client.build_request_data(AgentType.letta_v1_agent, messages2, llm_config, tools=[])

    async for _ in adapter2.invoke_llm(request_data=request_data2, messages=messages2, tools=[], use_assistant_message=False):
        pass

    print(
        f"Request 2 - prompt={adapter2.usage.prompt_tokens}, cached={adapter2.usage.cached_input_tokens}, cache_write={adapter2.usage.cache_write_tokens}"
    )

    # Verify basic usage
    assert adapter2.usage.prompt_tokens > 0
    assert adapter2.usage.completion_tokens > 0

    # Check for cache activity
    if adapter2.usage.cached_input_tokens and adapter2.usage.cached_input_tokens > 0:
        print(f"SUCCESS: Anthropic cache hit! cached_input_tokens={adapter2.usage.cached_input_tokens}")
    elif adapter2.usage.cache_write_tokens and adapter2.usage.cache_write_tokens > 0:
        print(f"INFO: Anthropic cache write! cache_write_tokens={adapter2.usage.cache_write_tokens}")
    else:
        print("INFO: No cache activity detected")


@pytest.mark.asyncio
async def test_gemini_prefix_caching_via_adapter():
    """Test Gemini prefix caching through SimpleLLMRequestAdapter.

    Makes two requests with the same large system prompt to verify
    cached_input_tokens is populated.

    Note: Gemini 2.0+ has implicit caching.
    """
    if not _has_gemini_credentials():
        pytest.skip("Gemini credentials not configured")

    client = GoogleAIClient()
    llm_config = LLMConfig(
        model="gemini-2.0-flash",
        model_endpoint_type="google_ai",
        model_endpoint="https://generativelanguage.googleapis.com",
        context_window=1048576,
        max_tokens=256,
    )

    # First request
    adapter1 = SimpleLLMRequestAdapter(llm_client=client, llm_config=llm_config)
    messages1 = [
        Message(role=MessageRole.system, content=[TextContent(text=LARGE_SYSTEM_PROMPT)]),
        Message(role=MessageRole.user, content=[TextContent(text="What is 2+2?")]),
    ]
    request_data1 = client.build_request_data(AgentType.letta_v1_agent, messages1, llm_config, tools=[])

    try:
        async for _ in adapter1.invoke_llm(request_data=request_data1, messages=messages1, tools=[], use_assistant_message=False):
            pass
    except LLMAuthenticationError:
        pytest.skip("Gemini credentials invalid")

    print(f"Request 1 - prompt={adapter1.usage.prompt_tokens}, cached={adapter1.usage.cached_input_tokens}")

    # Second request
    adapter2 = SimpleLLMRequestAdapter(llm_client=client, llm_config=llm_config)
    messages2 = [
        Message(role=MessageRole.system, content=[TextContent(text=LARGE_SYSTEM_PROMPT)]),
        Message(role=MessageRole.user, content=[TextContent(text="What is 3+3?")]),
    ]
    request_data2 = client.build_request_data(AgentType.letta_v1_agent, messages2, llm_config, tools=[])

    async for _ in adapter2.invoke_llm(request_data=request_data2, messages=messages2, tools=[], use_assistant_message=False):
        pass

    print(f"Request 2 - prompt={adapter2.usage.prompt_tokens}, cached={adapter2.usage.cached_input_tokens}")

    # Verify basic usage
    assert adapter2.usage.prompt_tokens > 0
    assert adapter2.usage.completion_tokens > 0

    if adapter2.usage.cached_input_tokens and adapter2.usage.cached_input_tokens > 0:
        print(f"SUCCESS: Gemini cache hit! cached_input_tokens={adapter2.usage.cached_input_tokens}")
    else:
        print("INFO: No cache hit detected")
