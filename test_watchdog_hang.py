#!/usr/bin/env python3
"""
Test script to verify the watchdog detects event loop hangs.
Run this to validate the watchdog works before deploying.
"""

import asyncio
import logging
import sys
import time
from pathlib import Path

# Setup logging to see watchdog output
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

# Add letta to path
sys.path.insert(0, str(Path(__file__).parent))

from letta.monitoring.event_loop_watchdog import start_watchdog


def blocking_operation(seconds: float):
    """Simulate a blocking operation that hangs the event loop."""
    print(f"\n⚠️  BLOCKING event loop for {seconds}s (simulating hang)...")
    time.sleep(seconds)
    print("✓ Blocking operation completed\n")


async def test_watchdog_detection():
    """Test that watchdog detects event loop hangs."""
    print("\n" + "=" * 70)
    print("EVENT LOOP WATCHDOG TEST")
    print("=" * 70)

    # Start the watchdog with aggressive settings for testing
    loop = asyncio.get_running_loop()
    watchdog = start_watchdog(loop, check_interval=2.0, timeout_threshold=5.0)

    print("\n✓ Watchdog started (will alert if no heartbeat for >5s)")
    print("  Checking every 2 seconds...\n")

    # Test 1: Normal operation (should NOT trigger)
    print("TEST 1: Normal async operation (no hang expected)")
    print("-" * 70)
    for i in range(3):
        await asyncio.sleep(1)
        print(f"  Heartbeat {i + 1}/3 - event loop running normally")
    print("✓ Test 1 passed: No false alarms\n")

    await asyncio.sleep(3)

    # Test 2: Short block (should NOT trigger - under 5s threshold)
    print("TEST 2: Short blocking operation (4s - should NOT trigger)")
    print("-" * 70)
    blocking_operation(4.0)
    await asyncio.sleep(3)
    print("✓ Test 2 passed: Short blocks don't trigger false alarms\n")

    await asyncio.sleep(2)

    # Test 3: Long block (SHOULD trigger - exceeds 5s threshold)
    print("TEST 3: Long blocking operation (8s - SHOULD trigger watchdog)")
    print("-" * 70)
    print("🔍 Watch for ERROR logs from the watchdog...")
    blocking_operation(8.0)

    # Give watchdog time to detect and log
    await asyncio.sleep(3)

    print("\n" + "=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)
    print("\nExpected results:")
    print("  ✓ Test 1: No watchdog alerts (normal operation)")
    print("  ✓ Test 2: No watchdog alerts (4s < 5s threshold)")
    print("  ✓ Test 3: WATCHDOG ALERT logged (8s > 5s threshold)")
    print("\nIf you saw 'EVENT LOOP HANG DETECTED' in Test 3, watchdog works! ✓")
    print("\n")

    # Stop watchdog
    watchdog.stop()


async def main():
    """Run the test."""
    try:
        await test_watchdog_detection()
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
