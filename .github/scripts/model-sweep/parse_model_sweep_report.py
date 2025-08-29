#!/usr/bin/env python3
"""
Parse model sweep report JSON and generate global_models_config.json

This script processes the model sweep test results and creates a global configuration
file that serves as a single source of truth for model capabilities and support status.
"""

import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Set


def load_config(config_file: str = None) -> Dict[str, Any]:
    """Load configuration from config.json file."""
    if config_file is None:
        # Default to config.json in the same directory as this script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        config_file = os.path.join(script_dir, "config.json")

    try:
        with open(config_file, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: Could not find config file '{config_file}'")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"❌ Error: Invalid JSON in config file '{config_file}'")
        sys.exit(1)


def get_test_category_from_name(test_name: str, feature_mapping: Dict[str, List[str]]) -> str:
    """Categorize tests into functional categories based on test name and feature mapping."""
    for category, tests in feature_mapping.items():
        if test_name in tests:
            return category

    return "Other"


def get_support_status(passed_tests: Set[str], feature_tests: List[str]) -> str:
    """Determine support status for a feature category."""
    if not feature_tests:
        return "❓"  # Unknown - no tests for this feature

    # Filter out error tests when checking for support
    non_error_tests = [test for test in feature_tests if not test.endswith("_error")]
    error_tests = [test for test in feature_tests if test.endswith("_error")]

    # Check which non-error tests passed
    passed_non_error_tests = [test for test in non_error_tests if test in passed_tests]

    # If there are no non-error tests, only error tests, treat as unknown
    if not non_error_tests:
        return "❓"  # Only error tests available

    # Support is based only on non-error tests
    if len(passed_non_error_tests) == len(non_error_tests):
        return "✅"  # Full support
    elif len(passed_non_error_tests) == 0:
        return "❌"  # No support
    else:
        return "⚠️"  # Partial support


def parse_model_sweep_report(
    input_file: str,
    output_file: str,
    config_file: str = None,
    compact_output_file: str = None,
) -> None:
    """Parse model sweep report and generate global models config."""

    print("📖 Reading configuration...")
    config = load_config(config_file)

    feature_mapping = config.get("feature_mappings", {})
    if not feature_mapping:
        print("❌ Error: No 'feature_mappings' found in config file")
        sys.exit(1)

    print(f"📊 Loaded {len(feature_mapping)} feature categories from config")

    print(f"📄 Reading model sweep report from: {input_file}")

    # Read the JSON data
    with open(input_file, "r") as f:
        data = json.load(f)

    tests = data.get("tests", [])
    summary = data.get("summary", {})

    print(f"🔍 Processing {len(tests)} test results...")

    # Get all feature categories from config
    all_feature_categories = list(feature_mapping.keys())

    # Group tests by provider and model
    provider_groups = defaultdict(lambda: defaultdict(list))

    for test in tests:
        # Extract test metadata
        metadata = test.get("metadata", {})
        llm_config = metadata.get("llm_config", {})

        provider_name = llm_config.get("provider_name", "unknown")
        model_name = llm_config.get("model", "unknown")

        provider_groups[provider_name][model_name].append(test)

    # Process each provider and model
    global_config = {
        "generated_at": datetime.now().isoformat(),
        "source_report": os.path.basename(input_file),
        "config_file": os.path.basename(config_file) if config_file else "config.json",
        "total_tests_run": len(tests),
        "summary": summary,
        "feature_categories": all_feature_categories,
        "feature_mappings": feature_mapping,
        "providers": {},
    }

    total_models_processed = 0

    for provider_name, models in provider_groups.items():
        print(f"🏢 Processing provider: {provider_name}")

        provider_config = {"models": {}, "model_count": len(models)}

        for model_name, model_tests in models.items():
            total_models_processed += 1
            print(f"  🤖 Processing model: {model_name}")

            # Extract model metadata from first test
            first_test = model_tests[0]
            llm_config = first_test["metadata"]["llm_config"]

            # Categorize and analyze tests
            passed_tests = set()
            failed_tests = set()
            test_results = {}

            # Group tests by category
            category_tests = defaultdict(list)

            for test in model_tests:
                # Extract test name from nodeid
                test_name = test["nodeid"].split("::")[1].split("[")[0]
                category = get_test_category_from_name(test_name, feature_mapping)
                category_tests[category].append(test_name)

                # Track pass/fail status
                outcome = test.get("outcome", "unknown")
                test_results[test_name] = outcome

                if outcome == "passed":
                    passed_tests.add(test_name)
                elif outcome == "failed":
                    failed_tests.add(test_name)

            # Calculate feature support status
            feature_support = {}
            for category in all_feature_categories:
                tests_in_category = category_tests.get(category, [])
                feature_support[category] = get_support_status(passed_tests, tests_in_category)

            # Get last scanned time
            last_scanned = datetime.now().strftime("%Y-%m-%d")

            # Create model configuration
            model_config = {
                "provider_name": provider_name,
                "model_name": model_name,
                "model_endpoint_type": llm_config.get("model_endpoint_type"),
                "model_endpoint": llm_config.get("model_endpoint"),
                "provider_category": llm_config.get("provider_category"),
                "context_window": llm_config.get("context_window"),
                "handle": llm_config.get("handle"),
                "temperature": llm_config.get("temperature"),
                "max_tokens": llm_config.get("max_tokens"),
                "last_scanned": last_scanned,
                "feature_support": feature_support,
                "test_results": {
                    "total_tests": len(model_tests),
                    "passed_tests": len(passed_tests),
                    "failed_tests": len(failed_tests),
                    "detailed_results": test_results,
                },
                "capabilities": {
                    # Create boolean capabilities based on feature support
                    category.lower().replace(" ", "_"): feature_support.get(category) == "✅"
                    for category in all_feature_categories
                },
            }

            provider_config["models"][model_name] = model_config

        global_config["providers"][provider_name] = provider_config

    global_config["total_models"] = total_models_processed
    global_config["total_providers"] = len(provider_groups)

    # Create compact version with flat structure
    compact_config = {
        "generated_at": datetime.now().isoformat(),
        "source_report": os.path.basename(input_file),
        "config_file": os.path.basename(config_file) if config_file else "config.json",
        "total_tests_run": len(tests),
        "summary": summary,
        "models": {},
    }

    # Create detailed version with same flat structure but including test details
    detailed_config = {
        "generated_at": datetime.now().isoformat(),
        "source_report": os.path.basename(input_file),
        "config_file": os.path.basename(config_file) if config_file else "config.json",
        "total_tests_run": len(tests),
        "summary": summary,
        "models": {},
    }

    # Populate both configs with flat model structure
    for provider_name, provider_info in global_config["providers"].items():
        for model_name, model_config in provider_info["models"].items():
            # Create handle key
            handle = model_config.get("handle", f"{provider_name}/{model_name}")

            # Base model info for both configs
            base_model_info = {
                "provider_name": model_config["provider_name"],
                "model_name": model_config["model_name"],
                "model_endpoint_type": model_config.get("model_endpoint_type"),
                "model_endpoint": model_config.get("model_endpoint"),
                "provider_category": model_config.get("provider_category"),
                "context_window": model_config["context_window"],
                "handle": handle,
                "temperature": model_config.get("temperature"),
                "max_tokens": model_config.get("max_tokens"),
                "last_scanned": model_config["last_scanned"],
                "capabilities": {category: model_config["feature_support"].get(category) == "✅" for category in all_feature_categories},
            }

            # Compact version - just the base info
            compact_config["models"][handle] = base_model_info

            # Detailed version - includes test results and capabilities details
            detailed_model_info = base_model_info.copy()
            detailed_model_info.update({"test_results": model_config["test_results"]})
            detailed_config["models"][handle] = detailed_model_info

    # Write the detailed config file (original structure)
    print(f"💾 Writing detailed global models config to: {output_file}")
    with open(output_file, "w") as f:
        json.dump(detailed_config, f, indent=2)

    # Write the compact config file
    if compact_output_file:
        print(f"💾 Writing compact global models config to: {compact_output_file}")
        with open(compact_output_file, "w") as f:
            json.dump(compact_config, f, indent=2)

    print(f"✅ Successfully processed {total_models_processed} models across {len(provider_groups)} providers")
    print(f"📄 Detailed config saved to: {output_file}")
    if compact_output_file:
        print(f"📄 Compact config saved to: {compact_output_file}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_model_sweep_report.py <input_file> [detailed_output_file] [config_file] [compact_output_file]")
        print(
            "Example: python parse_model_sweep_report.py model_sweep_report.json global_models_config.json config.json global_models_config_compact.json"
        )
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "global_models_config.json"
    config_file = sys.argv[3] if len(sys.argv) > 3 else None
    compact_output_file = sys.argv[4] if len(sys.argv) > 4 else None

    # Handle relative paths by resolving them relative to the script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))

    if not os.path.isabs(input_file):
        input_file = os.path.join(script_dir, input_file)

    if not os.path.isabs(output_file):
        output_file = os.path.join(script_dir, output_file)

    if config_file and not os.path.isabs(config_file):
        config_file = os.path.join(script_dir, config_file)

    if compact_output_file and not os.path.isabs(compact_output_file):
        compact_output_file = os.path.join(script_dir, compact_output_file)

    try:
        parse_model_sweep_report(input_file, output_file, config_file, compact_output_file)
    except FileNotFoundError as e:
        print(f"❌ Error: Could not find file - {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Error: Invalid JSON - {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
