"""
Local test for temporal metrics.
Run with: uv run pytest tests/test_temporal_metrics_local.py -v -s
"""

import asyncio
import os
from unittest.mock import MagicMock, patch

import pytest

from letta.agents.temporal.metrics import (
    ActivityMetrics,
    TemporalMetrics,
    WorkerMetrics,
    WorkflowMetrics,
)


@pytest.fixture(autouse=True)
def setup_metrics():
    """Setup metrics for testing."""
    # Force re-initialization
    TemporalMetrics._initialized = False

    # Enable metrics for testing
    os.environ["DD_METRICS_ENABLED"] = "true"
    os.environ["DD_AGENT_HOST"] = "localhost"
    os.environ["DD_DOGSTATSD_PORT"] = "8125"
    os.environ["DD_ENV"] = "local-test"
    os.environ["DD_SERVICE"] = "letta-temporal-test"

    yield

    # Cleanup
    TemporalMetrics._initialized = False


@pytest.mark.asyncio
async def test_metrics_initialization():
    """Test that metrics initialize correctly."""
    TemporalMetrics.initialize()

    assert TemporalMetrics._initialized is True
    print(f"\n✓ Metrics initialized: enabled={TemporalMetrics.is_enabled()}")


@pytest.mark.asyncio
async def test_workflow_metrics():
    """Test workflow metrics recording."""
    with patch("letta.agents.temporal.metrics.statsd") as mock_statsd:
        TemporalMetrics._initialized = False
        TemporalMetrics._enabled = True
        TemporalMetrics._initialized = True

        # Record workflow metrics
        WorkflowMetrics.record_workflow_start(workflow_type="TemporalAgentWorkflow", workflow_id="test-workflow-123")

        WorkflowMetrics.record_workflow_success(
            workflow_type="TemporalAgentWorkflow",
            workflow_id="test-workflow-123",
            duration_ns=1_000_000_000,  # 1 second
        )

        WorkflowMetrics.record_workflow_usage(
            workflow_type="TemporalAgentWorkflow",
            step_count=5,
            completion_tokens=100,
            prompt_tokens=50,
            total_tokens=150,
        )

        # Verify metrics were called
        assert mock_statsd.increment.called
        assert mock_statsd.histogram.called
        assert mock_statsd.gauge.called

        print("\n✓ Workflow metrics recorded successfully")
        print(f"  - increment called {mock_statsd.increment.call_count} times")
        print(f"  - histogram called {mock_statsd.histogram.call_count} times")
        print(f"  - gauge called {mock_statsd.gauge.call_count} times")


@pytest.mark.asyncio
async def test_activity_metrics():
    """Test activity metrics recording."""
    with patch("letta.agents.temporal.metrics.statsd") as mock_statsd:
        TemporalMetrics._initialized = False
        TemporalMetrics._enabled = True
        TemporalMetrics._initialized = True

        # Record activity metrics
        ActivityMetrics.record_activity_start("llm_request")
        ActivityMetrics.record_activity_success("llm_request", duration_ms=500.0)

        # Verify metrics were called
        assert mock_statsd.increment.called
        assert mock_statsd.histogram.called

        print("\n✓ Activity metrics recorded successfully")
        print(f"  - increment called {mock_statsd.increment.call_count} times")


@pytest.mark.asyncio
async def test_metrics_with_real_dogstatsd():
    """
    Test metrics with real DogStatsD connection (requires Datadog agent running).
    This test will skip if the agent is not available.
    """
    import socket

    # Check if DogStatsD is listening
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("localhost", 8125))
        dogstatsd_available = True
        sock.close()
    except Exception:
        dogstatsd_available = False

    if not dogstatsd_available:
        pytest.skip("DogStatsD not available on localhost:8125")

    # Force re-initialization with real connection
    TemporalMetrics._initialized = False
    TemporalMetrics.initialize()

    # Send test metrics
    TemporalMetrics.increment("temporal.test.counter", value=1, tags=["test:true"])
    TemporalMetrics.gauge("temporal.test.gauge", value=42.0, tags=["test:true"])
    TemporalMetrics.histogram("temporal.test.histogram", value=100.0, tags=["test:true"])

    print("\n✓ Real metrics sent to DogStatsD at localhost:8125")
    print("  Check your Datadog UI for metrics with prefix 'temporal.test.*'")
