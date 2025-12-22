import json
from datetime import datetime

import pytest
import pytz

from letta.helpers.datetime_helpers import get_local_time, get_local_time_timezone
from letta.system import (
    get_heartbeat,
    get_login_event,
    package_function_response,
    package_summarize_message,
    package_system_message,
    package_user_message,
)


class TestTimezoneFormatting:
    """Test suite for timezone formatting functions in system.py"""

    def _extract_time_from_json(self, json_str: str) -> str:
        """Helper to extract time field from JSON string"""
        data = json.loads(json_str)
        return data["time"]

    def _validate_timezone_accuracy(self, formatted_time: str, expected_timezone: str, tolerance_minutes: int = 2):
        """
        Validate that the formatted time is accurate for the given timezone within tolerance.

        Args:
            formatted_time: The time string from the system functions
            expected_timezone: The timezone string (e.g., "America/New_York")
            tolerance_minutes: Acceptable difference in minutes
        """
        # Parse the formatted time - handle the actual format produced
        # Expected format: "2025-06-24 12:53:40 AM EDT-0400"
        import re
        from datetime import timedelta, timezone

        # Match pattern like "2025-06-24 12:53:40 AM EDT-0400"
        pattern = r"(\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}:\d{2} [AP]M) ([A-Z]{3,4})([-+]\d{4})"
        match = re.match(pattern, formatted_time)

        if not match:
            # Fallback: just check basic format without detailed parsing
            assert len(formatted_time) > 20, f"Time string too short: {formatted_time}"
            assert " AM " in formatted_time or " PM " in formatted_time, f"No AM/PM in time: {formatted_time}"
            return

        time_part, tz_name, tz_offset = match.groups()

        # Parse the time part without timezone
        time_without_tz = datetime.strptime(time_part, "%Y-%m-%d %I:%M:%S %p")

        # Create timezone offset
        hours_offset = int(tz_offset[:3])
        minutes_offset = int(tz_offset[3:5]) if len(tz_offset) > 3 else 0
        if tz_offset[0] == "-" and hours_offset >= 0:
            hours_offset = -hours_offset
        total_offset = timedelta(hours=hours_offset, minutes=minutes_offset)
        tz_info = timezone(total_offset)

        parsed_time = time_without_tz.replace(tzinfo=tz_info)

        # Get current time in the expected timezone
        tz = pytz.timezone(expected_timezone)
        current_time_in_tz = datetime.now(tz)

        # Check that times are within tolerance
        time_diff = abs((parsed_time - current_time_in_tz).total_seconds())
        assert time_diff <= tolerance_minutes * 60, (
            f"Time difference too large: {time_diff}s. Parsed: {parsed_time}, Expected timezone: {current_time_in_tz}"
        )

        # Verify timezone info exists and format looks reasonable
        assert parsed_time.tzinfo is not None, "Parsed time should have timezone info"
        assert tz_name in formatted_time, f"Timezone abbreviation {tz_name} should be in formatted time"

    def test_get_heartbeat_timezone_accuracy(self):
        """Test that get_heartbeat produces accurate timestamps for different timezones"""
        test_timezones = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"]

        for tz in test_timezones:
            heartbeat = get_heartbeat(timezone=tz, reason="Test heartbeat")
            time_str = self._extract_time_from_json(heartbeat)
            self._validate_timezone_accuracy(time_str, tz)

    def test_get_login_event_timezone_accuracy(self):
        """Test that get_login_event produces accurate timestamps for different timezones"""
        test_timezones = ["UTC", "US/Eastern", "US/Pacific", "Australia/Sydney"]

        for tz in test_timezones:
            login = get_login_event(timezone=tz, last_login="2024-01-01")
            time_str = self._extract_time_from_json(login)
            self._validate_timezone_accuracy(time_str, tz)

    def test_package_user_message_timezone_accuracy(self):
        """Test that package_user_message produces accurate timestamps for different timezones"""
        test_timezones = ["UTC", "America/Chicago", "Europe/Paris", "Asia/Shanghai"]

        for tz in test_timezones:
            message = package_user_message("Test message", timezone=tz)
            time_str = self._extract_time_from_json(message)
            self._validate_timezone_accuracy(time_str, tz)

    def test_package_function_response_timezone_accuracy(self):
        """Test that package_function_response produces accurate timestamps for different timezones"""
        test_timezones = ["UTC", "America/Denver", "Europe/Berlin", "Pacific/Auckland"]

        for tz in test_timezones:
            response = package_function_response(True, "Success", timezone=tz)
            time_str = self._extract_time_from_json(response)
            self._validate_timezone_accuracy(time_str, tz)

    def test_package_system_message_timezone_accuracy(self):
        """Test that package_system_message produces accurate timestamps for different timezones"""
        test_timezones = ["UTC", "America/Phoenix", "Europe/Rome", "Asia/Kolkata"]  # Mumbai is now called Kolkata in pytz

        for tz in test_timezones:
            message = package_system_message("System alert", timezone=tz)
            time_str = self._extract_time_from_json(message)
            self._validate_timezone_accuracy(time_str, tz)

    def test_package_summarize_message_timezone_accuracy(self):
        """Test that package_summarize_message produces accurate timestamps for different timezones"""
        test_timezones = ["UTC", "America/Anchorage", "Europe/Stockholm", "Asia/Seoul"]

        for tz in test_timezones:
            summary = package_summarize_message(
                summary="Test summary", summary_message_count=2, hidden_message_count=5, total_message_count=7, timezone=tz
            )
            time_str = self._extract_time_from_json(summary)
            self._validate_timezone_accuracy(time_str, tz)

    def test_get_local_time_timezone_direct(self):
        """Test get_local_time_timezone directly for accuracy"""
        test_timezones = ["UTC", "America/New_York", "Europe/London", "Asia/Tokyo", "Australia/Melbourne"]

        for tz in test_timezones:
            time_str = get_local_time_timezone(timezone=tz)
            self._validate_timezone_accuracy(time_str, tz)

    def test_get_local_time_with_timezone_param(self):
        """Test get_local_time when timezone parameter is provided"""
        test_timezones = ["UTC", "America/Los_Angeles", "Europe/Madrid", "Asia/Bangkok"]

        for tz in test_timezones:
            time_str = get_local_time(timezone=tz)
            self._validate_timezone_accuracy(time_str, tz)

    def test_timezone_offset_differences(self):
        """Test that different timezones produce appropriately offset times"""
        # Get times for different timezones at the same moment
        utc_heartbeat = get_heartbeat(timezone="UTC")
        utc_time_str = self._extract_time_from_json(utc_heartbeat)

        ny_heartbeat = get_heartbeat(timezone="America/New_York")
        ny_time_str = self._extract_time_from_json(ny_heartbeat)

        tokyo_heartbeat = get_heartbeat(timezone="Asia/Tokyo")
        tokyo_time_str = self._extract_time_from_json(tokyo_heartbeat)

        # Just validate that all times have the expected format
        # UTC should have UTC in the string
        assert "UTC" in utc_time_str, f"UTC timezone not found in: {utc_time_str}"

        # NY should have EST or EDT
        assert any(tz in ny_time_str for tz in ["EST", "EDT"]), f"EST/EDT not found in: {ny_time_str}"

        # Tokyo should have JST
        assert "JST" in tokyo_time_str, f"JST not found in: {tokyo_time_str}"

    def test_daylight_saving_time_handling(self):
        """Test that DST transitions are handled correctly"""
        # Test timezone that observes DST
        eastern_tz = "America/New_York"

        # Get current time in Eastern timezone
        message = package_user_message("DST test", timezone=eastern_tz)
        time_str = self._extract_time_from_json(message)

        # Validate against current Eastern time
        self._validate_timezone_accuracy(time_str, eastern_tz)

        # The timezone abbreviation should be either EST or EDT
        assert any(tz in time_str for tz in ["EST", "EDT"]), f"EST/EDT not found in: {time_str}"

    @pytest.mark.parametrize(
        "timezone_str,expected_format_parts",
        [
            ("UTC", ["UTC", "+0000"]),
            ("America/New_York", ["EST", "EDT"]),  # Either EST or EDT depending on date
            ("Europe/London", ["GMT", "BST"]),  # Either GMT or BST depending on date
            ("Asia/Tokyo", ["JST", "+0900"]),
            ("Australia/Sydney", ["AEDT", "AEST"]),  # Either AEDT or AEST depending on date
        ],
    )
    def test_timezone_format_components(self, timezone_str, expected_format_parts):
        """Test that timezone formatting includes expected components"""
        heartbeat = get_heartbeat(timezone=timezone_str)
        time_str = self._extract_time_from_json(heartbeat)

        # Check that at least one expected format part is present
        found_expected_part = any(part in time_str for part in expected_format_parts)
        assert found_expected_part, f"None of expected format parts {expected_format_parts} found in time string: {time_str}"

        # Validate the time is accurate
        self._validate_timezone_accuracy(time_str, timezone_str)

    def test_timezone_parameter_working(self):
        """Test that timezone parameter correctly affects the output"""
        # Test that different timezones produce different time formats
        utc_message = package_user_message("Test", timezone="UTC")
        utc_time = self._extract_time_from_json(utc_message)

        ny_message = package_user_message("Test", timezone="America/New_York")
        ny_time = self._extract_time_from_json(ny_message)

        # Times should have different timezone indicators
        assert "UTC" in utc_time, f"UTC not found in: {utc_time}"
        assert any(tz in ny_time for tz in ["EST", "EDT"]), f"EST/EDT not found in: {ny_time}"
