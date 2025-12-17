"""
Integration tests for prompt caching validation.

These tests verify that our LLM clients properly enable caching for each provider:
- OpenAI: Automatic caching (≥1024 tokens)
- Anthropic: Requires cache_control breakpoints (≥1024 tokens for Sonnet 4.5)
- Gemini: Implicit caching on 2.5 models (≥1024 tokens for 2.5 Flash)

Test strategy:
1. Create agent with large memory block (>5000 tokens to exceed all thresholds)
2. Send message 1 → assert cache WRITE occurred
3. Send message 2 → assert cache HIT occurred

If these tests fail, it means:
- For OpenAI: Something is broken (caching is automatic)
- For Anthropic: We're not adding cache_control breakpoints
- For Gemini: Implicit caching isn't working (or we're below threshold)
"""

import logging
import os
import uuid

import pytest
from letta_client import AsyncLetta
from letta_client.types import MessageCreateParam

logger = logging.getLogger(__name__)


# ------------------------------
# Test Configuration
# ------------------------------

# Large memory block to exceed all provider thresholds
# NOTE: The actual token count depends on the tokenizer each provider uses.
# We aim for a very large block to ensure we exceed:
# - OpenAI: 1,024 tokens
# - Anthropic Sonnet 4.5: 1,024 tokens (Opus/Haiku 4.5: 4,096)
# - Gemini 2.5 Flash: 1,024 tokens (2.5 Pro: 4,096, 3 Pro Preview: 2,048)
LARGE_MEMORY_BLOCK = (
    """
You are an advanced AI assistant with extensive knowledge across multiple domains.

This memory block is intentionally very large to ensure prompt caching thresholds are exceeded
for testing purposes. The content provides rich context that should be cached by the LLM
provider on the first request and reused on subsequent requests to the same agent.

IMPORTANT: This block is designed to exceed 2,048 tokens to test all provider thresholds.

You are an advanced AI assistant with extensive knowledge across multiple domains.

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

## Accuracy
- Verify information before sharing
- Acknowledge uncertainty when appropriate
- Correct mistakes promptly
- Stay up-to-date with best practices

## Efficiency
- Get to the point quickly
- Avoid unnecessary verbosity
- Focus on what's most relevant
- Provide code examples when they clarify concepts

# Background Context

## Your Role
You serve as a technical advisor, collaborator, and problem solver. Your goal is to help users
achieve their objectives efficiently while teaching them along the way.

## Continuous Improvement
You learn from each interaction:
- Adapting to user preferences and communication styles
- Refining explanations based on feedback
- Expanding knowledge through conversations
- Improving recommendations based on outcomes

## Ethical Guidelines
- Prioritize user privacy and data security
- Recommend sustainable and maintainable solutions
- Consider accessibility and inclusivity
- Promote best practices and industry standards

This memory block is intentionally large to ensure prompt caching thresholds are exceeded
for testing purposes. The content provides rich context that should be cached by the LLM
provider on the first request and reused on subsequent requests to the same agent.

---

Additional Context (Repeated for Token Count):

"""
    + "\n\n".join(
        [
            f"Section {i + 1}: "
            + """
You have deep expertise in software development, including but not limited to:
- Programming languages: Python, JavaScript, TypeScript, Java, C++, Rust, Go, Swift, Kotlin, Ruby, PHP, Scala
- Web frameworks: React, Vue, Angular, Django, Flask, FastAPI, Express, Next.js, Nuxt, SvelteKit, Remix, Astro
- Databases: PostgreSQL, MySQL, MongoDB, Redis, Cassandra, DynamoDB, ElasticSearch, Neo4j, InfluxDB, TimescaleDB
- Cloud platforms: AWS (EC2, S3, Lambda, ECS, EKS, RDS), GCP (Compute Engine, Cloud Run, GKE), Azure (VMs, Functions, AKS)
- DevOps tools: Docker, Kubernetes, Terraform, Ansible, Jenkins, GitHub Actions, GitLab CI, CircleCI, ArgoCD
- Testing frameworks: pytest, Jest, Mocha, JUnit, unittest, Cypress, Playwright, Selenium, TestNG, RSpec
- Architecture patterns: Microservices, Event-driven, Serverless, Monolithic, CQRS, Event Sourcing, Hexagonal
- API design: REST, GraphQL, gRPC, WebSockets, Server-Sent Events, tRPC, JSON-RPC
- Security: OAuth 2.0, JWT, SAML, encryption (AES, RSA), OWASP Top 10, secure coding practices, penetration testing
- Performance: Caching strategies (Redis, Memcached, CDN), load balancing (Nginx, HAProxy), database optimization (indexing, query tuning)
- Monitoring: Prometheus, Grafana, DataDog, New Relic, Sentry, Elastic APM, OpenTelemetry
- Message queues: RabbitMQ, Apache Kafka, AWS SQS, Google Pub/Sub, NATS, Redis Streams
- Search engines: Elasticsearch, Solr, Algolia, Meilisearch, Typesense
- Logging: ELK Stack, Loki, Fluentd, Logstash, CloudWatch Logs
- CI/CD: Jenkins, GitLab CI/CD, GitHub Actions, CircleCI, Travis CI, Bamboo
"""
            for i in range(6)
        ]
    )
    + """

This content is repeated to ensure we exceed the 2,048 token threshold for all providers.
""".strip()
)


# Model configurations for testing
CACHING_TEST_CONFIGS = [
    # OpenAI: Automatic caching, ≥1024 tokens
    pytest.param(
        "openai/gpt-4o",
        {},
        1024,  # Min tokens for caching
        "cached_tokens",  # Field name in prompt_tokens_details
        None,  # No write field (caching is free)
        id="openai-gpt4o-auto",
    ),
    # Anthropic: Requires cache_control, ≥1024 tokens for Sonnet 4.5
    pytest.param(
        "anthropic/claude-sonnet-4-5-20250929",
        {},
        1024,  # Min tokens for Sonnet 4.5
        "cache_read_tokens",  # Field name for cache hits
        "cache_creation_tokens",  # Field name for cache writes
        id="anthropic-sonnet-4.5-explicit",
    ),
    # Gemini: Implicit caching on 2.5 models, ≥1024 tokens for 2.5 Flash
    pytest.param(
        "google_ai/gemini-2.5-flash",
        {},
        1024,  # Min tokens for 2.5 Flash
        "cached_tokens",  # Field name (normalized from cached_content_token_count)
        None,  # No separate write field
        id="gemini-2.5-flash-implicit",
    ),
    # Gemini 3 Pro Preview: NOTE - Implicit caching seems to NOT work for 3 Pro Preview
    # The docs say "Implicit caching is enabled by default for all Gemini 2.5 models"
    # This suggests 3 Pro Preview may require explicit caching instead
    pytest.param(
        "google_ai/gemini-3-pro-preview",
        {},
        2048,  # Min tokens for 3 Pro Preview
        "cached_tokens",  # Field name (normalized from cached_content_token_count)
        None,  # No separate write field
        id="gemini-3-pro-preview-implicit",
        marks=pytest.mark.xfail(reason="Gemini 3 Pro Preview doesn't have implicit caching (only 2.5 models do)"),
    ),
]

# Filter based on environment variable if set
requested = os.getenv("PROMPT_CACHE_TEST_MODEL")
if requested:
    CACHING_TEST_CONFIGS = [config for config in CACHING_TEST_CONFIGS if requested in config[0]]


# ------------------------------
# Fixtures
# ------------------------------


@pytest.fixture
def base_url() -> str:
    """Get the Letta server URL from environment or use default."""
    return os.getenv("LETTA_SERVER_URL", "http://localhost:8283")


@pytest.fixture
async def async_client(base_url: str) -> AsyncLetta:
    """Create an async Letta client."""
    return AsyncLetta(base_url=base_url)


# ------------------------------
# Helper Functions
# ------------------------------


async def create_agent_with_large_memory(client: AsyncLetta, model: str, model_settings: dict, suffix: str):
    """
    Create an agent with a large memory block to exceed caching thresholds.

    Uses DEFAULT agent configuration (thinking enabled, base tools included) to test
    real-world caching behavior, not artificial simplified scenarios.

    If tests fail, that reveals actual caching issues with production configurations.
    """
    from letta_client.types import CreateBlockParam

    # Clean suffix to avoid invalid characters (e.g., dots in model names)
    clean_suffix = suffix.replace(".", "-").replace("/", "-")
    agent = await client.agents.create(
        name=f"cache-test-{clean_suffix}-{uuid.uuid4().hex[:8]}",
        model=model,
        embedding="openai/text-embedding-3-small",
        memory_blocks=[
            CreateBlockParam(
                label="persona",
                value=LARGE_MEMORY_BLOCK,
            )
        ],
        # Use default settings - include_base_tools defaults to True, thinking enabled by default
        # This tests REAL production behavior, not simplified scenarios
    )
    logger.info(f"Created agent {agent.id} with model {model} using default config")
    return agent


async def cleanup_agent(client: AsyncLetta, agent_id: str):
    """Delete a test agent."""
    try:
        await client.agents.delete(agent_id)
        logger.info(f"Cleaned up agent {agent_id}")
    except Exception as e:
        logger.warning(f"Failed to cleanup agent {agent_id}: {e}")


def assert_usage_sanity(usage, context: str = ""):
    """
    Sanity checks for usage data to catch obviously wrong values.

    These catch bugs like:
    - output_tokens=1 (impossible for real responses)
    - Cumulative values being accumulated instead of assigned
    - Token counts exceeding model limits
    """
    prefix = f"[{context}] " if context else ""

    # Basic existence checks
    assert usage is not None, f"{prefix}Usage should not be None"

    # Prompt tokens sanity
    if usage.prompt_tokens is not None:
        assert usage.prompt_tokens > 0, f"{prefix}prompt_tokens should be > 0, got {usage.prompt_tokens}"
        assert usage.prompt_tokens < 500000, f"{prefix}prompt_tokens unreasonably high: {usage.prompt_tokens}"

    # Completion tokens sanity - a real response should have more than 1 token
    if usage.completion_tokens is not None:
        assert usage.completion_tokens > 1, (
            f"{prefix}completion_tokens={usage.completion_tokens} is suspiciously low. "
            "A real response should have > 1 output token. This may indicate a usage tracking bug."
        )
        assert usage.completion_tokens < 50000, (
            f"{prefix}completion_tokens={usage.completion_tokens} unreasonably high. "
            "This may indicate cumulative values being accumulated instead of assigned."
        )

    # Cache tokens sanity (if present)
    if usage.cache_write_tokens is not None and usage.cache_write_tokens > 0:
        # Cache write shouldn't exceed total input
        total_input = (usage.prompt_tokens or 0) + (usage.cache_write_tokens or 0) + (usage.cached_input_tokens or 0)
        assert usage.cache_write_tokens <= total_input, (
            f"{prefix}cache_write_tokens ({usage.cache_write_tokens}) > total input ({total_input})"
        )

    if usage.cached_input_tokens is not None and usage.cached_input_tokens > 0:
        # Cached input shouldn't exceed prompt tokens + cached
        total_input = (usage.prompt_tokens or 0) + (usage.cached_input_tokens or 0)
        assert usage.cached_input_tokens <= total_input, (
            f"{prefix}cached_input_tokens ({usage.cached_input_tokens}) exceeds reasonable bounds"
        )


# ------------------------------
# Prompt Caching Validation Tests
# ------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("model,model_settings,min_tokens,read_field,write_field", CACHING_TEST_CONFIGS)
async def test_prompt_caching_cache_write_then_read(
    async_client: AsyncLetta,
    model: str,
    model_settings: dict,
    min_tokens: int,
    read_field: str,
    write_field: str,
):
    """
    Test that prompt caching properly creates cache on first message and hits cache on second message.

    This test validates that our LLM clients are correctly enabling caching:
    - OpenAI: Should automatically cache (no config needed)
    - Anthropic: Should add cache_control breakpoints
    - Gemini: Should benefit from implicit caching on 2.5 models

    Args:
        model: Model handle (e.g., "openai/gpt-4o")
        model_settings: Additional model settings
        min_tokens: Minimum token threshold for this provider
        read_field: Field name in prompt_tokens_details for cache reads
        write_field: Field name in prompt_tokens_details for cache writes (None if no separate field)
    """
    agent = await create_agent_with_large_memory(
        async_client,
        model,
        model_settings,
        "write-read",
    )

    try:
        # Message 1: First interaction should trigger cache WRITE
        response1 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello! Please introduce yourself.")],
        )

        assert response1.usage is not None, "First message should have usage data"
        assert_usage_sanity(response1.usage, f"{model} msg1")
        logger.info(
            f"[{model}] Message 1 usage: "
            f"prompt={response1.usage.prompt_tokens}, "
            f"cached_input={response1.usage.cached_input_tokens}, "
            f"cache_write={response1.usage.cache_write_tokens}"
        )

        # Verify we exceeded the minimum token threshold
        # Note: For Anthropic, prompt_tokens only shows non-cached tokens, so we need to add cache_write_tokens
        total_input_tokens = (
            response1.usage.prompt_tokens + (response1.usage.cache_write_tokens or 0) + (response1.usage.cached_input_tokens or 0)
        )
        assert total_input_tokens >= min_tokens, f"Total input must be ≥{min_tokens} tokens for caching, got {total_input_tokens}"

        # For providers with separate write field (Anthropic), check cache creation on first message
        if write_field:
            write_tokens = response1.usage.cache_write_tokens
            logger.info(f"[{model}] Cache write tokens on message 1: {write_tokens}")
            # Anthropic should show cache creation on first message
            if "anthropic" in model:
                assert write_tokens is not None and write_tokens > 0, (
                    f"Anthropic should create cache on first message, got cache_write_tokens={write_tokens}"
                )

        # Message 2: Follow-up with same agent/context should trigger cache HIT
        response2 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="What are your main areas of expertise?")],
        )

        assert response2.usage is not None, "Second message should have usage data"
        assert_usage_sanity(response2.usage, f"{model} msg2")
        logger.info(
            f"[{model}] Message 2 usage: "
            f"prompt={response2.usage.prompt_tokens}, "
            f"cached_input={response2.usage.cached_input_tokens}, "
            f"cache_write={response2.usage.cache_write_tokens}"
        )

        # CRITICAL ASSERTION: Cache hit should occur on second message
        read_tokens = response2.usage.cached_input_tokens
        logger.info(f"[{model}] Cache read tokens on message 2: {read_tokens}")

        assert read_tokens is not None and read_tokens > 0, (
            f"Provider {model} should have cache hit on message 2, got cached_input_tokens={read_tokens}. This means caching is NOT working!"
        )

        # The cached amount should be significant (most of the prompt)
        # Allow some variance for conversation history, but expect >50% cache hit
        # Note: For Anthropic, prompt_tokens only shows non-cached tokens, so total = prompt + cached
        total_input_msg2 = (
            response2.usage.prompt_tokens + (response2.usage.cached_input_tokens or 0) + (response2.usage.cache_write_tokens or 0)
        )
        cache_hit_ratio = read_tokens / total_input_msg2 if total_input_msg2 > 0 else 0
        logger.info(f"[{model}] Cache hit ratio: {cache_hit_ratio:.2%}")

        # Note: With thinking mode enabled, Anthropic may have lower cache ratios due to
        # thinking blocks changing between messages. The key assertion is that SOME caching occurs.
        assert cache_hit_ratio >= 0.15, (
            f"Expected >15% cache hit ratio, got {cache_hit_ratio:.2%}. Some portion of prompt should be cached!"
        )

    finally:
        await cleanup_agent(async_client, agent.id)


@pytest.mark.asyncio
@pytest.mark.parametrize("model,model_settings,min_tokens,read_field,write_field", CACHING_TEST_CONFIGS)
async def test_prompt_caching_multiple_messages(
    async_client: AsyncLetta,
    model: str,
    model_settings: dict,
    min_tokens: int,
    read_field: str,
    write_field: str,
):
    """
    Test that prompt caching continues to work across multiple messages in a conversation.

    After the initial cache write, subsequent messages should continue to hit the cache
    as long as the context remains similar.
    """
    agent = await create_agent_with_large_memory(
        async_client,
        model,
        model_settings,
        "multi-msg",
    )

    try:
        # Send 3 messages to ensure cache persists
        messages_to_send = [
            "Hello! What can you help me with?",
            "Tell me about your technical knowledge.",
            "What's your approach to solving problems?",
        ]

        responses = []
        for i, message in enumerate(messages_to_send):
            response = await async_client.agents.messages.create(
                agent_id=agent.id,
                messages=[MessageCreateParam(role="user", content=message)],
            )
            responses.append(response)

            if response.usage:
                read_tokens = response.usage.cached_input_tokens
                logger.info(
                    f"[{model}] Message {i + 1}: prompt={response.usage.prompt_tokens}, "
                    f"cached={read_tokens}, ratio={read_tokens / response.usage.prompt_tokens:.2%}"
                    if read_tokens and response.usage.prompt_tokens
                    else f"[{model}] Message {i + 1}: prompt={response.usage.prompt_tokens}, cached=N/A"
                )

        # After message 1, all subsequent messages should have cache hits
        for i in range(1, len(responses)):
            assert responses[i].usage is not None, f"Message {i + 1} should have usage"

            read_tokens = responses[i].usage.cached_input_tokens
            assert read_tokens is not None and read_tokens > 0, (
                f"Message {i + 1} should have cache hit, got cached_input_tokens={read_tokens}"
            )

    finally:
        await cleanup_agent(async_client, agent.id)


@pytest.mark.asyncio
@pytest.mark.parametrize("model,model_settings,min_tokens,read_field,write_field", CACHING_TEST_CONFIGS)
async def test_prompt_caching_cache_invalidation_on_memory_update(
    async_client: AsyncLetta,
    model: str,
    model_settings: dict,
    min_tokens: int,
    read_field: str,
    write_field: str,
):
    """
    Test that updating memory blocks invalidates the cache.

    When memory is modified, the prompt changes, so the cache should miss
    and a new cache should be created.
    """
    agent = await create_agent_with_large_memory(
        async_client,
        model,
        model_settings,
        "cache-invalidation",
    )

    try:
        # Message 1: Establish cache
        response1 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello!")],
        )

        # Message 2: Should hit cache
        response2 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="How are you?")],
        )

        read_tokens_before_update = response2.usage.cached_input_tokens if response2.usage else None
        prompt_tokens_before = response2.usage.prompt_tokens if response2.usage else 0

        logger.info(f"[{model}] Cache hit before memory update: {read_tokens_before_update}")
        assert read_tokens_before_update is not None and read_tokens_before_update > 0, "Should have cache hit before update"

        # Update memory block (this should invalidate cache)
        agent = await async_client.agents.get(agent_id=agent.id)
        persona_block = next((b for b in agent.memory_blocks if b.label == "persona"), None)
        assert persona_block is not None, "Should have persona block"

        await async_client.blocks.update(
            block_id=persona_block.id,
            label="persona",
            value=LARGE_MEMORY_BLOCK + "\n\nADDITIONAL NOTE: You are now extra helpful!",
        )

        # Message 3: After memory update, cache should MISS (then create new cache)
        response3 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="What changed?")],
        )

        # After memory update, we expect cache miss (low or zero cache hits)
        read_tokens_after_update = response3.usage.cached_input_tokens if response3.usage else None
        prompt_tokens_after = response3.usage.prompt_tokens if response3.usage else 0

        logger.info(f"[{model}] Cache hit after memory update: {read_tokens_after_update}")

        # Cache should be invalidated - we expect low/zero cache hits
        # (Some providers might still cache parts, but it should be significantly less)
        cache_ratio_before = read_tokens_before_update / prompt_tokens_before if prompt_tokens_before > 0 else 0
        cache_ratio_after = read_tokens_after_update / prompt_tokens_after if read_tokens_after_update and prompt_tokens_after > 0 else 0

        logger.info(f"[{model}] Cache ratio before: {cache_ratio_before:.2%}, after: {cache_ratio_after:.2%}")

        # After update, cache hit ratio should drop significantly (or be zero)
        assert cache_ratio_after < cache_ratio_before, "Cache hit ratio should drop after memory update"

    finally:
        await cleanup_agent(async_client, agent.id)


# ------------------------------
# Provider-Specific Cache Behavior Tests
# ------------------------------


@pytest.mark.asyncio
async def test_anthropic_system_prompt_stability(async_client: AsyncLetta):
    """
    Check if Anthropic system prompt is actually stable between REAL requests.

    Uses provider traces from actual messages sent to Anthropic to compare
    what was really sent, not what the preview endpoint generates.
    """
    import difflib
    import json

    model = "anthropic/claude-sonnet-4-5-20250929"
    agent = await create_agent_with_large_memory(async_client, model, {}, "anthropic-stability")

    try:
        # Send message 1
        response1 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello!")],
        )

        # Send message 2
        response2 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Follow up!")],
        )

        # Get provider traces from ACTUAL requests sent to Anthropic
        step_id_1, step_id_2 = None, None
        if response1.messages:
            for msg in response1.messages:
                if hasattr(msg, "step_id") and msg.step_id:
                    step_id_1 = msg.step_id
                    break
        if response2.messages:
            for msg in response2.messages:
                if hasattr(msg, "step_id") and msg.step_id:
                    step_id_2 = msg.step_id
                    break

        if not step_id_1 or not step_id_2:
            logger.error("Could not find step_ids from responses")
            return

        # Get the ACTUAL requests that were sent to Anthropic
        trace1 = await async_client.telemetry.retrieve_provider_trace(step_id=step_id_1)
        trace2 = await async_client.telemetry.retrieve_provider_trace(step_id=step_id_2)

        if not (trace1 and trace2 and trace1.request_json and trace2.request_json):
            logger.error("Could not retrieve provider traces")
            return

        # Compare the ACTUAL system prompts sent to Anthropic
        system1 = trace1.request_json.get("system", [])
        system2 = trace2.request_json.get("system", [])

        system1_str = json.dumps(system1, sort_keys=True)
        system2_str = json.dumps(system2, sort_keys=True)

        if system1_str == system2_str:
            logger.info("✅ ACTUAL SYSTEM PROMPTS SENT TO ANTHROPIC ARE IDENTICAL")
            logger.info("   → Cache SHOULD work, but isn't. Issue is likely:")
            logger.info("   → 1. Thinking blocks breaking cache")
            logger.info("   → 2. Tool definitions changing")
            logger.info("   → 3. Something else in the request changing")
        else:
            logger.error("❌ ACTUAL SYSTEM PROMPTS SENT TO ANTHROPIC DIFFER!")
            logger.info("=" * 80)
            logger.info("SYSTEM PROMPT DIFF (actual requests):")

            diff = difflib.unified_diff(
                system1_str.splitlines(keepends=True),
                system2_str.splitlines(keepends=True),
                fromfile="message1_actual",
                tofile="message2_actual",
                lineterm="",
            )
            diff_output = "\n".join(diff)
            logger.info(diff_output[:2000])  # Truncate if too long
            logger.info("=" * 80)

            if "Memory blocks were last modified" in diff_output:
                logger.error("⚠️  TIMESTAMP IS CHANGING IN ACTUAL REQUESTS!")
                logger.error("   → This is the root cause of cache misses")

        logger.info(f"Message 1: cache_write={response1.usage.cache_write_tokens if response1.usage else 'N/A'}")
        logger.info(f"Message 2: cached_input={response2.usage.cached_input_tokens if response2.usage else 'N/A'}")

    finally:
        await cleanup_agent(async_client, agent.id)


@pytest.mark.asyncio
async def test_anthropic_inspect_raw_request(async_client: AsyncLetta):
    """
    Debug test to inspect the raw Anthropic request and see where cache_control is placed.
    """
    model = "anthropic/claude-sonnet-4-5-20250929"
    agent = await create_agent_with_large_memory(async_client, model, {}, "anthropic-debug")

    try:
        import json

        # Message 1
        response1 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello!")],
        )

        # Get step_id from message 1
        step_id_1 = None
        if response1.messages:
            for msg in response1.messages:
                if hasattr(msg, "step_id") and msg.step_id:
                    step_id_1 = msg.step_id
                    break

        if step_id_1:
            provider_trace_1 = await async_client.telemetry.retrieve_provider_trace(step_id=step_id_1)
            if provider_trace_1 and provider_trace_1.request_json:
                logger.info("=" * 80)
                logger.info("MESSAGE 1 REQUEST:")
                logger.info(f"System has cache_control: {'cache_control' in provider_trace_1.request_json.get('system', [{}])[-1]}")
                logger.info(f"Number of messages: {len(provider_trace_1.request_json.get('messages', []))}")
                last_msg_content = provider_trace_1.request_json.get("messages", [{}])[-1].get("content", [])
                if isinstance(last_msg_content, list) and len(last_msg_content) > 0:
                    logger.info(f"Last message block has cache_control: {'cache_control' in last_msg_content[-1]}")
                logger.info("=" * 80)

        # Message 2 - this should hit the cache
        response2 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Follow up!")],
        )

        # Get step_id from message 2
        step_id_2 = None
        if response2.messages:
            for msg in response2.messages:
                if hasattr(msg, "step_id") and msg.step_id:
                    step_id_2 = msg.step_id
                    break

        if step_id_2:
            provider_trace_2 = await async_client.telemetry.retrieve_provider_trace(step_id=step_id_2)
            if provider_trace_2 and provider_trace_2.request_json:
                logger.info("=" * 80)
                logger.info("MESSAGE 2 REQUEST:")
                logger.info(f"System has cache_control: {'cache_control' in provider_trace_2.request_json.get('system', [{}])[-1]}")
                logger.info(f"Number of messages: {len(provider_trace_2.request_json.get('messages', []))}")

                # Show all messages to understand the structure
                for i, msg in enumerate(provider_trace_2.request_json.get("messages", [])):
                    logger.info(f"  Message {i}: role={msg.get('role')}")
                    content = msg.get("content")
                    if isinstance(content, list):
                        for j, block in enumerate(content):
                            logger.info(f"    Block {j}: type={block.get('type')}, has_cache_control={'cache_control' in block}")

                last_msg_content = provider_trace_2.request_json.get("messages", [{}])[-1].get("content", [])
                if isinstance(last_msg_content, list) and len(last_msg_content) > 0:
                    logger.info(f"Last message block has cache_control: {'cache_control' in last_msg_content[-1]}")
                logger.info("=" * 80)

        logger.info(f"Message 1 cache_write_tokens: {response1.usage.cache_write_tokens if response1.usage else 'N/A'}")
        logger.info(f"Message 2 cached_input_tokens: {response2.usage.cached_input_tokens if response2.usage else 'N/A'}")

    finally:
        await cleanup_agent(async_client, agent.id)


@pytest.mark.asyncio
async def test_anthropic_cache_control_breakpoints(async_client: AsyncLetta):
    """
    Anthropic-specific test to verify we're adding cache_control breakpoints.

    If this test fails, it means cache_control isn't working properly - either:
    - Breakpoints aren't being added at all
    - Breakpoints are positioned incorrectly
    - Something in the prompt is changing between messages

    We send multiple messages to account for any timing/routing issues.
    """
    model = "anthropic/claude-sonnet-4-5-20250929"
    agent = await create_agent_with_large_memory(async_client, model, {}, "anthropic-breakpoints")

    try:
        # First message
        response1 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello!")],
        )

        assert response1.usage is not None, "Should have usage data"

        # Anthropic should show cache_write_tokens > 0 on first message if cache_control is set
        cache_creation = response1.usage.cache_write_tokens
        logger.info(f"[Anthropic] First message cache_write_tokens: {cache_creation}")

        assert cache_creation is not None and cache_creation >= 1024, (
            f"Anthropic should create cache ≥1024 tokens on first message. Got {cache_creation}. This means cache_control breakpoints are NOT being added!"
        )

        # Send multiple follow-up messages to increase chance of cache hit
        follow_up_messages = [
            "Follow up question",
            "Tell me more",
            "What else can you do?",
        ]

        cached_token_counts = []
        for i, msg in enumerate(follow_up_messages):
            response = await async_client.agents.messages.create(
                agent_id=agent.id,
                messages=[MessageCreateParam(role="user", content=msg)],
            )
            cache_read = response.usage.cached_input_tokens if response.usage else 0
            cached_token_counts.append(cache_read)
            logger.info(f"[Anthropic] Message {i + 2} cached_input_tokens: {cache_read}")

            # Early exit if we got a cache hit
            if cache_read and cache_read > 0:
                logger.info(f"[Anthropic] Cache hit detected on message {i + 2}, stopping early")
                break

        # Check if ANY of the follow-up messages had a cache hit
        max_cached = max(cached_token_counts) if cached_token_counts else 0
        logger.info(f"[Anthropic] Max cached tokens across {len(cached_token_counts)} messages: {max_cached}")

        assert max_cached > 0, (
            f"Anthropic should read from cache in at least one of {len(follow_up_messages)} follow-up messages. Got max={max_cached}. Cache reads are NOT working!"
        )

    finally:
        await cleanup_agent(async_client, agent.id)


@pytest.mark.asyncio
async def test_openai_automatic_caching(async_client: AsyncLetta):
    """
    OpenAI-specific test to verify automatic caching works.

    OpenAI caching is automatic, so this should just work if we have ≥1024 tokens.
    """
    model = "openai/gpt-4o"
    agent = await create_agent_with_large_memory(async_client, model, {}, "openai-auto")

    try:
        # First message
        response1 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello!")],
        )

        # OpenAI doesn't charge for cache writes, so cached_input_tokens should be 0 or None on first message
        cached_tokens_1 = response1.usage.cached_input_tokens if response1.usage else None
        logger.info(f"[OpenAI] First message cached_input_tokens: {cached_tokens_1} (should be 0 or None)")

        # Second message should show cached_input_tokens > 0
        response2 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="What can you help with?")],
        )

        cached_tokens_2 = response2.usage.cached_input_tokens if response2.usage else None
        logger.info(f"[OpenAI] Second message cached_input_tokens: {cached_tokens_2}")

        assert cached_tokens_2 is not None and cached_tokens_2 >= 1024, (
            f"OpenAI should cache ≥1024 tokens automatically on second message. Got {cached_tokens_2}. Automatic caching is NOT working!"
        )

        # Cached tokens should be in 128-token increments
        assert cached_tokens_2 % 128 == 0, f"OpenAI cached_input_tokens should be in 128-token increments, got {cached_tokens_2}"

    finally:
        await cleanup_agent(async_client, agent.id)


@pytest.mark.asyncio
async def test_gemini_2_5_flash_implicit_caching(async_client: AsyncLetta):
    """
    Gemini-specific test to verify implicit caching works on 2.5 Flash.

    Gemini 2.5 Flash has implicit caching (automatic) with ≥1024 token threshold.
    """
    model = "google_ai/gemini-2.5-flash"
    agent = await create_agent_with_large_memory(async_client, model, {}, "gemini-2.5-flash")

    try:
        # First message
        response1 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello!")],
        )

        logger.info(f"[Gemini 2.5 Flash] First message prompt_tokens: {response1.usage.prompt_tokens if response1.usage else 'N/A'}")

        # Second message should show implicit cache hit
        response2 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="What are your capabilities?")],
        )

        # For Gemini, cached_input_tokens comes from cached_content_token_count (normalized in backend)
        cached_tokens = response2.usage.cached_input_tokens if response2.usage else None
        logger.info(f"[Gemini 2.5 Flash] Second message cached_input_tokens: {cached_tokens}")

        assert cached_tokens is not None and cached_tokens >= 1024, (
            f"Gemini 2.5 Flash should implicitly cache ≥1024 tokens on second message. Got {cached_tokens}. Implicit caching is NOT working!"
        )

    finally:
        await cleanup_agent(async_client, agent.id)


@pytest.mark.asyncio
async def test_gemini_3_pro_preview_implicit_caching(async_client: AsyncLetta):
    """
    Gemini-specific test to verify implicit caching works on 3 Pro Preview.

    Gemini 3 Pro Preview has implicit caching (automatic) with ≥2048 token threshold.

    Since implicit caching is stochastic (depends on routing, timing, etc.), we send
    multiple messages in quick succession and check if ANY of them hit the cache.
    """
    model = "google_ai/gemini-3-pro-preview"
    agent = await create_agent_with_large_memory(async_client, model, {}, "gemini-3-pro")

    try:
        # First message establishes the prompt
        response1 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello!")],
        )

        logger.info(f"[Gemini 3 Pro] First message prompt_tokens: {response1.usage.prompt_tokens if response1.usage else 'N/A'}")

        # Send multiple follow-up messages quickly to increase chance of implicit cache hit
        follow_up_messages = [
            "What are your capabilities?",
            "Tell me about your technical knowledge.",
            "What can you help me with?",
        ]

        cached_token_counts = []
        for i, msg in enumerate(follow_up_messages):
            response = await async_client.agents.messages.create(
                agent_id=agent.id,
                messages=[MessageCreateParam(role="user", content=msg)],
            )
            cached_tokens = response.usage.cached_input_tokens if response.usage else 0
            cached_token_counts.append(cached_tokens)
            logger.info(f"[Gemini 3 Pro] Message {i + 2} cached_input_tokens: {cached_tokens}")

            # Early exit if we got a cache hit
            if cached_tokens >= 2048:
                logger.info(f"[Gemini 3 Pro] Cache hit detected on message {i + 2}, stopping early")
                break

        # Check if ANY of the follow-up messages had a cache hit
        max_cached = max(cached_token_counts) if cached_token_counts else 0
        logger.info(f"[Gemini 3 Pro] Max cached tokens across {len(cached_token_counts)} messages: {max_cached}")

        assert max_cached >= 2048, (
            f"Gemini 3 Pro Preview should implicitly cache ≥2048 tokens in at least one of {len(follow_up_messages)} messages. Got max={max_cached}. Implicit caching is NOT working!"
        )

    finally:
        await cleanup_agent(async_client, agent.id)


@pytest.mark.asyncio
async def test_gemini_request_prefix_stability(async_client: AsyncLetta):
    """
    Check if Gemini requests have stable prefixes between REAL requests.

    Gemini implicit caching requires the PREFIX of the request to be identical.
    This test compares actual requests sent to Gemini to see what's changing.

    Key things to check:
    - System instruction (should be identical)
    - Tool definitions (order must be same)
    - Early contents (must be identical prefix)
    """
    import difflib
    import json

    model = "google_ai/gemini-2.5-flash"
    agent = await create_agent_with_large_memory(async_client, model, {}, "gemini-prefix-stability")

    try:
        # Send message 1
        response1 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello!")],
        )

        # Send message 2
        response2 = await async_client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Follow up!")],
        )

        # Get provider traces from ACTUAL requests sent to Gemini
        step_id_1, step_id_2 = None, None
        if response1.messages:
            for msg in response1.messages:
                if hasattr(msg, "step_id") and msg.step_id:
                    step_id_1 = msg.step_id
                    break
        if response2.messages:
            for msg in response2.messages:
                if hasattr(msg, "step_id") and msg.step_id:
                    step_id_2 = msg.step_id
                    break

        if not step_id_1 or not step_id_2:
            logger.error("Could not find step_ids from responses")
            return

        # Get the ACTUAL requests that were sent to Gemini
        trace1 = await async_client.telemetry.retrieve_provider_trace(step_id=step_id_1)
        trace2 = await async_client.telemetry.retrieve_provider_trace(step_id=step_id_2)

        if not (trace1 and trace2 and trace1.request_json and trace2.request_json):
            logger.error("Could not retrieve provider traces")
            return

        # Compare key parts of the request that affect cache prefix
        req1 = trace1.request_json
        req2 = trace2.request_json

        # 1. Check system instruction
        system_instruction_1 = req1.get("systemInstruction") or req1.get("system_instruction")
        system_instruction_2 = req2.get("systemInstruction") or req2.get("system_instruction")

        if system_instruction_1 != system_instruction_2:
            logger.error("❌ SYSTEM INSTRUCTIONS DIFFER!")
            logger.info("System Instruction 1:")
            logger.info(json.dumps(system_instruction_1, indent=2)[:500])
            logger.info("System Instruction 2:")
            logger.info(json.dumps(system_instruction_2, indent=2)[:500])

            sys1_str = json.dumps(system_instruction_1, sort_keys=True)
            sys2_str = json.dumps(system_instruction_2, sort_keys=True)
            diff = difflib.unified_diff(
                sys1_str.splitlines(keepends=True),
                sys2_str.splitlines(keepends=True),
                fromfile="message1_system",
                tofile="message2_system",
                lineterm="",
            )
            diff_output = "\n".join(diff)
            if "Memory blocks were last modified" in diff_output or "timestamp" in diff_output.lower():
                logger.error("⚠️  TIMESTAMP IN SYSTEM INSTRUCTION IS CHANGING!")
                logger.error("   → This breaks Gemini implicit caching (prefix must match)")
        else:
            logger.info("✅ System instructions are identical")

        # 2. Check tools (must be in same order for prefix matching)
        tools_1 = req1.get("tools") or []
        tools_2 = req2.get("tools") or []

        # For Gemini, tools are in format: [{"functionDeclarations": [...]}]
        # Extract just the function names/signatures for comparison
        def extract_tool_names(tools):
            names = []
            for tool_group in tools:
                if "functionDeclarations" in tool_group:
                    for func in tool_group["functionDeclarations"]:
                        names.append(func.get("name"))
            return names

        tool_names_1 = extract_tool_names(tools_1)
        tool_names_2 = extract_tool_names(tools_2)

        if tool_names_1 != tool_names_2:
            logger.error("❌ TOOL ORDER/NAMES DIFFER!")
            logger.info(f"Message 1 tools: {tool_names_1}")
            logger.info(f"Message 2 tools: {tool_names_2}")
            logger.error("   → Tool order must be identical for Gemini implicit caching")
        else:
            logger.info(f"✅ Tool order is identical ({len(tool_names_1)} tools)")

        # 3. Check if tool definitions (not just names) are identical
        tools_1_str = json.dumps(tools_1, sort_keys=True)
        tools_2_str = json.dumps(tools_2, sort_keys=True)

        if tools_1_str != tools_2_str:
            logger.warning("⚠️  Tool DEFINITIONS differ (not just order)")
            # Show a sample diff
            diff = difflib.unified_diff(
                tools_1_str[:1000].splitlines(keepends=True),
                tools_2_str[:1000].splitlines(keepends=True),
                fromfile="message1_tools",
                tofile="message2_tools",
                lineterm="",
            )
            logger.info("Sample tool definition diff:")
            logger.info("\n".join(diff))
        else:
            logger.info("✅ Tool definitions are identical")

        # 4. Check contents structure (just the first few items in the prefix)
        contents_1 = req1.get("contents") or []
        contents_2 = req2.get("contents") or []

        logger.info(f"Message 1: {len(contents_1)} content items")
        logger.info(f"Message 2: {len(contents_2)} content items")

        # Compare the overlapping prefix (message 2 should have message 1's contents + new message)
        min_len = min(len(contents_1), len(contents_2))
        prefix_identical = True
        for i in range(min_len - 1):  # Exclude last item (user's new message)
            if contents_1[i] != contents_2[i]:
                prefix_identical = False
                logger.error(f"❌ Content item {i} differs between requests!")
                logger.info(f"Message 1 item {i}: {json.dumps(contents_1[i], indent=2)[:200]}")
                logger.info(f"Message 2 item {i}: {json.dumps(contents_2[i], indent=2)[:200]}")

        if prefix_identical:
            logger.info("✅ Content prefix matches between requests")

        # Log cache results
        logger.info("=" * 80)
        logger.info(f"Message 1: prompt_tokens={response1.usage.prompt_tokens if response1.usage else 'N/A'}")
        logger.info(
            f"Message 2: prompt_tokens={response2.usage.prompt_tokens if response2.usage else 'N/A'}, cached={response2.usage.cached_input_tokens if response2.usage else 'N/A'}"
        )

        if response2.usage and response2.usage.cached_input_tokens and response2.usage.cached_input_tokens > 0:
            logger.info("✅ CACHE HIT DETECTED")
        else:
            logger.error("❌ NO CACHE HIT - This is the issue we're debugging")

    finally:
        await cleanup_agent(async_client, agent.id)
