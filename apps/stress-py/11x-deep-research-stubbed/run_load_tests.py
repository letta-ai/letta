#!/usr/bin/env python
"""
Load test runner for different Letta API operations
"""

import asyncio
import sys
import argparse

# Import test modules
from async_load_test import main as async_test
from background_stream_load_test import main as stream_test
from file_load_test import main as file_test


async def run_test(test_name: str):
    """Run a specific load test"""
    tests = {
        "async": ("Async Message Load Test", async_test),
        "stream": ("Background Stream Load Test", stream_test),
        "file": ("File Upload Load Test", file_test),
    }

    if test_name not in tests:
        print(f"Unknown test: {test_name}")
        print(f"Available tests: {', '.join(tests.keys())}")
        return 1

    test_title, test_func = tests[test_name]
    print(f"\n{'=' * 60}")
    print(f"Running: {test_title}")
    print(f"{'=' * 60}\n")

    try:
        await test_func()
        return 0
    except Exception as e:
        print(f"Test failed: {e}")
        return 1


async def run_all_tests():
    """Run all load tests sequentially"""
    tests = ["async", "stream", "file"]
    results = {}

    for test_name in tests:
        print(f"\n{'#' * 60}")
        print(f"# TEST: {test_name.upper()}")
        print(f"{'#' * 60}")

        result = await run_test(test_name)
        results[test_name] = "PASSED" if result == 0 else "FAILED"

        # Brief pause between tests
        await asyncio.sleep(5)

    # Print summary
    print(f"\n{'=' * 60}")
    print("LOAD TEST SUMMARY")
    print(f"{'=' * 60}")
    for test_name, status in results.items():
        print(f"{test_name:15} : {status}")

    return 0 if all(s == "PASSED" for s in results.values()) else 1


def main():
    parser = argparse.ArgumentParser(
        description="Run Letta API load tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run all tests
  %(prog)s --all

  # Run specific test
  %(prog)s --test file
  %(prog)s --test async
  %(prog)s --test stream
        """,
    )

    parser.add_argument(
        "--test", choices=["async", "stream", "file"], help="Run specific test"
    )
    parser.add_argument("--all", action="store_true", help="Run all tests")

    args = parser.parse_args()

    if not args.test and not args.all:
        parser.print_help()
        return 1

    if args.all:
        return asyncio.run(run_all_tests())
    else:
        return asyncio.run(run_test(args.test))


if __name__ == "__main__":
    sys.exit(main())
