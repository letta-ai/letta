"""
Unit tests for the convert_statuses_to_enum function in the runs API router.

These tests verify that status string conversion to RunStatus enums works correctly.
"""

import pytest

from letta.schemas.enums import RunStatus
from letta.server.rest_api.routers.v1.runs import convert_statuses_to_enum


def test_convert_statuses_to_enum_with_none():
    """Test that convert_statuses_to_enum returns None when input is None."""
    result = convert_statuses_to_enum(None)
    assert result is None


def test_convert_statuses_to_enum_with_single_status():
    """Test converting a single status string to RunStatus enum."""
    result = convert_statuses_to_enum(["completed"])
    assert result == [RunStatus.completed]
    assert len(result) == 1


def test_convert_statuses_to_enum_with_multiple_statuses():
    """Test converting multiple status strings to RunStatus enums."""
    result = convert_statuses_to_enum(["created", "running", "completed"])
    assert result == [RunStatus.created, RunStatus.running, RunStatus.completed]
    assert len(result) == 3


def test_convert_statuses_to_enum_with_all_statuses():
    """Test converting all possible status strings."""
    all_statuses = ["created", "running", "completed", "failed", "cancelled"]
    result = convert_statuses_to_enum(all_statuses)
    assert result == [RunStatus.created, RunStatus.running, RunStatus.completed, RunStatus.failed, RunStatus.cancelled]
    assert len(result) == 5


def test_convert_statuses_to_enum_with_empty_list():
    """Test converting an empty list."""
    result = convert_statuses_to_enum([])
    assert result == []


def test_convert_statuses_to_enum_with_invalid_status():
    """Test that invalid status strings raise ValueError."""
    with pytest.raises(ValueError):
        convert_statuses_to_enum(["invalid_status"])


def test_convert_statuses_to_enum_preserves_order():
    """Test that the order of statuses is preserved."""
    input_statuses = ["failed", "created", "completed", "running"]
    result = convert_statuses_to_enum(input_statuses)
    assert result == [RunStatus.failed, RunStatus.created, RunStatus.completed, RunStatus.running]


def test_convert_statuses_to_enum_with_duplicate_statuses():
    """Test that duplicate statuses are preserved."""
    input_statuses = ["completed", "completed", "running"]
    result = convert_statuses_to_enum(input_statuses)
    assert result == [RunStatus.completed, RunStatus.completed, RunStatus.running]
    assert len(result) == 3


def test_convert_statuses_to_enum_case_sensitivity():
    """Test that the function is case-sensitive and requires exact matches."""
    with pytest.raises(ValueError):
        convert_statuses_to_enum(["COMPLETED"])

    with pytest.raises(ValueError):
        convert_statuses_to_enum(["Completed"])


def test_convert_statuses_to_enum_with_mixed_valid_invalid():
    """Test that if any status is invalid, the entire conversion fails."""
    with pytest.raises(ValueError):
        convert_statuses_to_enum(["completed", "invalid", "running"])
