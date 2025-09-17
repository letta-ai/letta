#!/usr/bin/env python3
import json
import os
import sys
from collections import defaultdict
from datetime import datetime


def load_feature_mappings(config_file=None):
    """Load feature mappings from config file."""
    if config_file is None:
        # Default to feature_mappings.json in the same directory as this script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        config_file = os.path.join(script_dir, "feature_mappings.json")

    try:
        with open(config_file, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find feature mappings config file '{config_file}'")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in feature mappings config file '{config_file}'")
        sys.exit(1)


def get_support_status(passed_tests, feature_tests):
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


def categorize_tests(all_test_names, feature_mapping):
    """Categorize test names into feature buckets."""
    categorized = {feature: [] for feature in feature_mapping.keys()}

    for test_name in all_test_names:
        for feature, test_patterns in feature_mapping.items():
            if test_name in test_patterns:
                categorized[feature].append(test_name)
                break

    return categorized


def calculate_support_score(feature_support, feature_order):
    """Calculate a numeric support score for ranking models.

    For partial support, the score is weighted by the position of the feature
    in the feature_order list (earlier features get higher weight).
    """
    score = 0
    max_features = len(feature_order)

    for feature, status in feature_support.items():
        # Get position weight (earlier features get higher weight)
        if feature in feature_order:
            position_weight = (max_features - feature_order.index(feature)) / max_features
        else:
            position_weight = 0.5  # Default weight for unmapped features

        if status == "✅":  # Full support
            score += 10 * position_weight
        elif status == "⚠️":  # Partial support - weighted by column position
            score += 5 * position_weight
        elif status == "❌":  # No support
            score += 1 * position_weight
        # Unknown (❓) gets 0 points
    return score


def calculate_provider_support_score(models_data, feature_order):
    """Calculate a provider-level support score based on all models' support scores."""
    if not models_data:
        return 0

    # Calculate the average support score across all models in the provider
    total_score = sum(model["support_score"] for model in models_data)
    return total_score / len(models_data)


def get_test_function_line_numbers(test_file_path):
    """Extract line numbers for test functions from the test file."""
    test_line_numbers = {}

    try:
        with open(test_file_path, "r") as f:
            lines = f.readlines()

        for i, line in enumerate(lines, 1):
            if "def test_" in line and line.strip().startswith("def test_"):
                # Extract function name
                func_name = line.strip().split("def ")[1].split("(")[0]
                test_line_numbers[func_name] = i
    except FileNotFoundError:
        print(f"Warning: Could not find test file at {test_file_path}")

    return test_line_numbers


def get_github_repo_info():
    """Get GitHub repository information from git remote."""
    try:
        # Try to get the GitHub repo URL from git remote
        import subprocess

        result = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True, cwd=os.path.dirname(__file__))
        if result.returncode == 0:
            remote_url = result.stdout.strip()
            # Parse GitHub URL
            if "github.com" in remote_url:
                if remote_url.startswith("https://"):
                    # https://github.com/user/repo.git -> user/repo
                    repo_path = remote_url.replace("https://github.com/", "").replace(".git", "")
                elif remote_url.startswith("git@"):
                    # git@github.com:user/repo.git -> user/repo
                    repo_path = remote_url.split(":")[1].replace(".git", "")
                else:
                    return None
                return repo_path
    except:
        pass

    # Default fallback
    return "letta-ai/letta"


def generate_test_details(model_info, feature_mapping):
    """Generate detailed test results for a model."""
    details = []

    # Get test function line numbers
    script_dir = os.path.dirname(os.path.abspath(__file__))
    test_file_path = os.path.join(script_dir, "model_sweep.py")
    test_line_numbers = get_test_function_line_numbers(test_file_path)

    # Use the main branch GitHub URL
    base_github_url = "https://github.com/letta-ai/letta/blob/main/.github/scripts/model-sweep/model_sweep.py"

    for feature, tests in model_info["categorized_tests"].items():
        if not tests:
            continue

        details.append(f"### {feature}")
        details.append("")

        for test in sorted(tests):
            if test in model_info["passed_tests"]:
                status = "✅"
            elif test in model_info["failed_tests"]:
                status = "❌"
            else:
                status = "❓"

            # Create GitHub link if we have line number info
            if test in test_line_numbers:
                line_num = test_line_numbers[test]
                github_link = f"{base_github_url}#L{line_num}"
                details.append(f"- {status} [`{test}`]({github_link})")
            else:
                details.append(f"- {status} `{test}`")
        details.append("")

    return details


def calculate_column_widths(all_provider_data, feature_mapping):
    """Calculate the maximum width needed for each column across all providers."""
    widths = {"model": len("Model"), "context_window": len("Context Window"), "last_scanned": len("Last Scanned")}

    # Feature column widths
    for feature in feature_mapping.keys():
        widths[feature] = len(feature)

    # Check all model data for maximum widths
    for provider_data in all_provider_data.values():
        for model_info in provider_data:
            # Model name width (including backticks)
            model_width = len(f"`{model_info['name']}`")
            widths["model"] = max(widths["model"], model_width)

            # Context window width (with commas)
            context_width = len(f"{model_info['context_window']:,}")
            widths["context_window"] = max(widths["context_window"], context_width)

            # Last scanned width
            widths["last_scanned"] = max(widths["last_scanned"], len(str(model_info["last_scanned"])))

            # Feature support symbols are always 2 chars, so no need to check

    return widths


def process_model_sweep_report(input_file, output_file, config_file=None, debug=False):
    """Convert model sweep JSON data to MDX report."""

    # Load feature mappings from config file
    feature_mapping = load_feature_mappings(config_file)

    # if debug:
    #     print("DEBUG: Feature mappings loaded:")
    #     for feature, tests in feature_mapping.items():
    #         print(f"  {feature}: {tests}")
    #     print()

    # Read the JSON data
    with open(input_file, "r") as f:
        data = json.load(f)

    tests = data.get("tests", [])

    # if debug:
    #     print("DEBUG: Tests loaded:")
    #     print([test['outcome'] for test in tests if 'haiku' in test['nodeid']])

    # Calculate summary statistics
    providers = set(test["metadata"]["llm_config"]["provider_name"] for test in tests)
    models = set(test["metadata"]["llm_config"]["model"] for test in tests)
    total_tests = len(tests)

    # Start building the MDX
    mdx_lines = [
        "---",
        "title: Support Models",
        f"generated: {datetime.now().isoformat()}",
        "---",
        "",
        "# Supported Models",
        "",
        "## Overview",
        "",
        "Letta routinely runs automated scans against available providers and models. These are the results of the latest scan.",
        "",
        f"Ran {total_tests} tests against {len(models)} models across {len(providers)} providers on {datetime.now().strftime('%B %dth, %Y')}",
        "",
        "",
    ]

    # Group tests by provider
    provider_groups = defaultdict(list)
    for test in tests:
        provider_name = test["metadata"]["llm_config"]["provider_name"]
        provider_groups[provider_name].append(test)

    # Process all providers first to collect model data
    all_provider_data = {}
    provider_support_scores = {}

    for provider_name in provider_groups.keys():
        provider_tests = provider_groups[provider_name]

        # Group tests by model within this provider
        model_groups = defaultdict(list)
        for test in provider_tests:
            model_name = test["metadata"]["llm_config"]["model"]
            model_groups[model_name].append(test)

        # Process all models to calculate support scores for ranking
        model_data = []
        for model_name in model_groups.keys():
            model_tests = model_groups[model_name]

            # if debug:
            #     print(f"DEBUG: Processing model '{model_name}' in provider '{provider_name}'")

            # Extract unique test names for passed and failed tests
            passed_tests = set()
            failed_tests = set()
            all_test_names = set()

            for test in model_tests:
                # Extract test name from nodeid (split on :: and [)
                test_name = test["nodeid"].split("::")[1].split("[")[0]
                all_test_names.add(test_name)

                # if debug:
                #     print(f"  Test name: {test_name}")
                #     print(f"  Outcome: {test}")
                if test["outcome"] == "passed":
                    passed_tests.add(test_name)
                elif test["outcome"] == "failed":
                    failed_tests.add(test_name)

            # if debug:
            #     print(f"  All test names found: {sorted(all_test_names)}")
            #     print(f"  Passed tests: {sorted(passed_tests)}")
            #     print(f"  Failed tests: {sorted(failed_tests)}")

            # Categorize tests into features
            categorized_tests = categorize_tests(all_test_names, feature_mapping)

            # if debug:
            #     print(f"  Categorized tests:")
            #     for feature, tests in categorized_tests.items():
            #         print(f"    {feature}: {tests}")

            # Determine support status for each feature
            feature_support = {}
            for feature_name in feature_mapping.keys():
                feature_support[feature_name] = get_support_status(passed_tests, categorized_tests[feature_name])

            # if debug:
            #     print(f"  Feature support:")
            #     for feature, status in feature_support.items():
            #         print(f"    {feature}: {status}")
            #     print()

            # Get context window and last scanned time
            context_window = model_tests[0]["metadata"]["llm_config"]["context_window"]

            # Try to get time_last_scanned from metadata, fallback to current time
            try:
                last_scanned = model_tests[0]["metadata"].get(
                    "time_last_scanned", model_tests[0]["metadata"].get("timestamp", datetime.now().isoformat())
                )
                # Format timestamp if it's a full ISO string
                if "T" in str(last_scanned):
                    last_scanned = str(last_scanned).split("T")[0]  # Just the date part
            except:
                last_scanned = "Unknown"

            # Calculate support score for ranking
            feature_order = list(feature_mapping.keys())
            support_score = calculate_support_score(feature_support, feature_order)

            # Store model data for sorting
            model_data.append(
                {
                    "name": model_name,
                    "feature_support": feature_support,
                    "context_window": context_window,
                    "last_scanned": last_scanned,
                    "support_score": support_score,
                    "failed_tests": failed_tests,
                    "passed_tests": passed_tests,
                    "categorized_tests": categorized_tests,
                }
            )

        # Sort models by support score (descending) then by name (ascending)
        model_data.sort(key=lambda x: (-x["support_score"], x["name"]))

        # Store provider data
        all_provider_data[provider_name] = model_data
        provider_support_scores[provider_name] = calculate_provider_support_score(model_data, list(feature_mapping.keys()))

    # Calculate column widths for consistent formatting (add details column)
    column_widths = calculate_column_widths(all_provider_data, feature_mapping)
    column_widths["details"] = len("Details")

    # Sort providers by support score (descending) then by name (ascending)
    sorted_providers = sorted(provider_support_scores.keys(), key=lambda x: (-provider_support_scores[x], x))

    # Generate tables for all providers first
    for provider_name in sorted_providers:
        model_data = all_provider_data[provider_name]
        support_score = provider_support_scores[provider_name]

        # Create dynamic headers with proper padding and centering
        feature_names = list(feature_mapping.keys())

        # Build header row with left-aligned first column, centered others
        header_parts = [f"{'Model':<{column_widths['model']}}"]
        for feature in feature_names:
            header_parts.append(f"{feature:^{column_widths[feature]}}")
        header_parts.extend(
            [
                f"{'Context Window':^{column_widths['context_window']}}",
                f"{'Last Scanned':^{column_widths['last_scanned']}}",
                f"{'Details':^{column_widths['details']}}",
            ]
        )
        header_row = "| " + " | ".join(header_parts) + " |"

        # Build separator row with left-aligned first column, centered others
        separator_parts = [f"{'-' * column_widths['model']}"]
        for feature in feature_names:
            separator_parts.append(f":{'-' * (column_widths[feature] - 2)}:")
        separator_parts.extend(
            [
                f":{'-' * (column_widths['context_window'] - 2)}:",
                f":{'-' * (column_widths['last_scanned'] - 2)}:",
                f":{'-' * (column_widths['details'] - 2)}:",
            ]
        )
        separator_row = "|" + "|".join(separator_parts) + "|"

        # Add provider section without percentage
        mdx_lines.extend([f"## {provider_name}", "", header_row, separator_row])

        # Generate table rows for sorted models with proper padding
        for model_info in model_data:
            # Create anchor for model details
            model_anchor = model_info["name"].replace("/", "_").replace(":", "_").replace("-", "_").lower()
            details_anchor = f"{provider_name.lower().replace(' ', '_')}_{model_anchor}_details"

            # Build row with left-aligned first column, centered others
            row_parts = [f"`{model_info['name']}`".ljust(column_widths["model"])]
            for feature in feature_names:
                row_parts.append(f"{model_info['feature_support'][feature]:^{column_widths[feature]}}")
            row_parts.extend(
                [
                    f"{model_info['context_window']:,}".center(column_widths["context_window"]),
                    f"{model_info['last_scanned']}".center(column_widths["last_scanned"]),
                    f"[View](#{details_anchor})".center(column_widths["details"]),
                ]
            )
            row = "| " + " | ".join(row_parts) + " |"
            mdx_lines.append(row)

        # Add spacing between provider tables
        mdx_lines.extend(["", ""])

    # Add detailed test results section after all tables
    mdx_lines.extend(["---", "", "# Detailed Test Results", ""])

    for provider_name in sorted_providers:
        model_data = all_provider_data[provider_name]
        mdx_lines.extend([f"## {provider_name}", ""])

        for model_info in model_data:
            model_anchor = model_info["name"].replace("/", "_").replace(":", "_").replace("-", "_").lower()
            details_anchor = f"{provider_name.lower().replace(' ', '_')}_{model_anchor}_details"
            mdx_lines.append(f'<a id="{details_anchor}"></a>')
            mdx_lines.append(f"### {model_info['name']}")
            mdx_lines.append("")

            # Add test details
            test_details = generate_test_details(model_info, feature_mapping)
            mdx_lines.extend(test_details)

        # Add spacing between providers in details section
        mdx_lines.extend(["", ""])

    # Write the MDX file
    with open(output_file, "w") as f:
        f.write("\n".join(mdx_lines))

    print(f"Model sweep report saved to {output_file}")


def main():
    input_file = "model_sweep_report.json"
    output_file = "model_sweep_report.mdx"
    config_file = None
    debug = False

    # Allow command line arguments
    if len(sys.argv) > 1:
        # Use the file located in the same directory as this script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        input_file = os.path.join(script_dir, sys.argv[1])
    if len(sys.argv) > 2:
        # Use the file located in the same directory as this script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_file = os.path.join(script_dir, sys.argv[2])
    if len(sys.argv) > 3:
        config_file = sys.argv[3]
    if len(sys.argv) > 4 and sys.argv[4] == "--debug":
        debug = True

    try:
        process_model_sweep_report(input_file, output_file, config_file, debug)
    except FileNotFoundError:
        print(f"Error: Could not find input file '{input_file}'")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in file '{input_file}'")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
