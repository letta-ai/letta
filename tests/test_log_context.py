import json
import logging
from io import StringIO

import pytest

from letta.log import JSONFormatter, LogContextFilter
from letta.log_context import clear_log_context, get_log_context, remove_log_context, set_log_context, update_log_context


class TestLogContext:
    def test_set_log_context(self):
        clear_log_context()
        set_log_context("agent_id", "agent-123")
        assert get_log_context("agent_id") == "agent-123"
        clear_log_context()

    def test_update_log_context(self):
        clear_log_context()
        update_log_context(agent_id="agent-123", actor_id="user-456")
        context = get_log_context()
        assert context["agent_id"] == "agent-123"
        assert context["actor_id"] == "user-456"
        clear_log_context()

    def test_remove_log_context(self):
        clear_log_context()
        update_log_context(agent_id="agent-123", actor_id="user-456")
        remove_log_context("agent_id")
        context = get_log_context()
        assert "agent_id" not in context
        assert context["actor_id"] == "user-456"
        clear_log_context()

    def test_clear_log_context(self):
        update_log_context(agent_id="agent-123", actor_id="user-456")
        clear_log_context()
        context = get_log_context()
        assert context == {}

    def test_get_log_context_all(self):
        clear_log_context()
        update_log_context(agent_id="agent-123", actor_id="user-456")
        context = get_log_context()
        assert isinstance(context, dict)
        assert len(context) == 2
        clear_log_context()


class TestLogContextFilter:
    def test_filter_adds_context_to_record(self):
        clear_log_context()
        update_log_context(agent_id="agent-123", actor_id="user-456")

        log_filter = LogContextFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test message",
            args=(),
            exc_info=None,
        )

        result = log_filter.filter(record)
        assert result is True
        assert hasattr(record, "agent_id")
        assert record.agent_id == "agent-123"
        assert hasattr(record, "actor_id")
        assert record.actor_id == "user-456"
        clear_log_context()

    def test_filter_does_not_override_existing_attributes(self):
        clear_log_context()
        update_log_context(agent_id="agent-123")

        log_filter = LogContextFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test message",
            args=(),
            exc_info=None,
        )
        record.agent_id = "agent-999"

        log_filter.filter(record)
        assert record.agent_id == "agent-999"
        clear_log_context()


class TestLogContextIntegration:
    def test_json_formatter_includes_context(self):
        clear_log_context()
        update_log_context(agent_id="agent-123", actor_id="user-456")

        logger = logging.getLogger("test_logger")
        logger.setLevel(logging.INFO)

        handler = logging.StreamHandler(StringIO())
        handler.setFormatter(JSONFormatter())
        handler.addFilter(LogContextFilter())
        logger.addHandler(handler)

        log_stream = handler.stream
        logger.info("Test message")

        log_stream.seek(0)
        log_output = log_stream.read()

        log_data = json.loads(log_output)
        assert log_data["message"] == "Test message"
        assert log_data["agent_id"] == "agent-123"
        assert log_data["actor_id"] == "user-456"

        logger.removeHandler(handler)
        clear_log_context()

    def test_multiple_log_calls_with_changing_context(self):
        clear_log_context()
        logger = logging.getLogger("test_logger_2")
        logger.setLevel(logging.INFO)

        handler = logging.StreamHandler(StringIO())
        handler.setFormatter(JSONFormatter())
        handler.addFilter(LogContextFilter())
        logger.addHandler(handler)

        log_stream = handler.stream

        update_log_context(agent_id="agent-123")
        logger.info("First message")

        update_log_context(actor_id="user-456")
        logger.info("Second message")

        log_stream.seek(0)
        log_lines = log_stream.readlines()
        assert len(log_lines) == 2

        first_log = json.loads(log_lines[0])
        assert first_log["agent_id"] == "agent-123"
        assert "actor_id" not in first_log

        second_log = json.loads(log_lines[1])
        assert second_log["agent_id"] == "agent-123"
        assert second_log["actor_id"] == "user-456"

        logger.removeHandler(handler)
        clear_log_context()
