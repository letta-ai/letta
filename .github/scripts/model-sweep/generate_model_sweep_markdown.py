#!/usr/bin/env python3
"""
Generate model sweep markdown report from global_models_config.json

This script reads the global models configuration file and generates a formatted
MDX report for documentation purposes with support scoring and ranking.
"""

import json
import os
import sys
from datetime import datetime
from typing import Dict, List


def calculate_support_score(capabilities: Dict[str, bool]) -> float:
    """Calculate a numeric support score for ranking models.

    Assigns weights to different capabilities based on importance:
    - Basic: 10 points (most important)
    - Token Streaming: 5 points
    - Multimodal: 3 points
    """
    weights = {"Basic": 10, "Token Streaming": 5, "Multimodal": 3}

    score = 0
    for capability, supported in capabilities.items():
        if supported:
            score += weights.get(capability, 1)  # Default weight of 1 for unknown capabilities

    return score


def calculate_provider_support_score(models_data: List[Dict]) -> float:
    """Calculate a provider-level support score based on all models' support scores."""
    if not models_data:
        return 0

    # Calculate the average support score across all models in the provider
    total_score = sum(model["support_score"] for model in models_data)
    return total_score / len(models_data)


def process_global_models_config(input_file: str, output_file: str) -> None:
    """Convert global models config to MDX report with support scoring."""

    print(f"📖 Reading global models config from: {input_file}")

    with open(input_file, "r") as f:
        config = json.load(f)

    models = config.get("models", {})
    total_tests = config.get("total_tests_run", 0)
    total_models = len(models)

    # Group models by provider and calculate support scores
    providers = {}
    for handle, model_config in models.items():
        provider_name = model_config["provider_name"]
        if provider_name not in providers:
            providers[provider_name] = []

        # Calculate support score for this model
        support_score = calculate_support_score(model_config["capabilities"])

        providers[provider_name].append(
            {
                "handle": handle,
                "name": model_config["model_name"],
                "capabilities": model_config["capabilities"],
                "context_window": model_config["context_window"],
                "last_scanned": model_config["last_scanned"],
                "support_score": support_score,
            }
        )

    # Calculate provider support scores and sort providers
    provider_scores = {}
    for provider_name, provider_models in providers.items():
        provider_scores[provider_name] = calculate_provider_support_score(provider_models)

    # Sort providers by support score (descending), then alphabetically
    sorted_providers = sorted(providers.keys(), key=lambda x: (-provider_scores[x], x))

    # Sort models within each provider by support score (descending), then by name
    for provider_models in providers.values():
        provider_models.sort(key=lambda x: (-x["support_score"], x["name"]))

    # Get feature categories from first model
    feature_categories = list(next(iter(models.values()))["capabilities"].keys()) if models else []

    # Start building the MDX
    mdx_lines = [
        "---",
        "title: Supported Models",
        f"generated: {datetime.now().isoformat()}",
        "---",
        "",
        "# Supported Models",
        "",
        "## Overview",
        "",
        "Letta routinely runs automated scans against available providers and models. These are the results of the latest scan.",
        "",
        f"Ran {total_tests} tests against {total_models} models across {len(providers)} providers on {datetime.now().strftime('%B %dth, %Y')}",
        "",
        "",
    ]

    # Calculate column widths
    max_model_width = max((len(f"`{model['name']}`") for provider_models in providers.values() for model in provider_models), default=10)
    max_context_width = max(
        (len(f"{model['context_window']:,}") for provider_models in providers.values() for model in provider_models), default=10
    )

    # Generate output for each provider (now sorted by support score)
    for provider_name in sorted_providers:
        provider_models = providers[provider_name]

        print(f"🏢 Processing provider: {provider_name} ({len(provider_models)} models, score: {provider_scores[provider_name]:.1f})")

        # Build header row
        header_parts = [f"{'Model':<{max_model_width}}"]
        for feature in feature_categories:
            header_parts.append(f"{feature:^{len(feature)}}")
        header_parts.extend([f"{'Context Window':^{max_context_width}}", f"{'Last Scanned':^12}"])
        header_row = "| " + " | ".join(header_parts) + " |"

        # Build separator row
        separator_parts = [f"{'-' * max_model_width}"]
        for feature in feature_categories:
            separator_parts.append(f":{'-' * (len(feature) - 2)}:")
        separator_parts.extend([f":{'-' * (max_context_width - 2)}:", f":{'-' * 10}:"])
        separator_row = "|" + "|".join(separator_parts) + "|"

        # Add provider section
        mdx_lines.extend([f"## {provider_name}", "", header_row, separator_row])

        # Generate table rows (models already sorted by support score)
        for model in provider_models:
            row_parts = [f"`{model['name']}`".ljust(max_model_width)]
            for feature in feature_categories:
                symbol = "✅" if model["capabilities"][feature] else "❌"
                row_parts.append(f"{symbol:^{len(feature)}}")
            row_parts.extend([f"{model['context_window']:,}".center(max_context_width), f"{model['last_scanned']}".center(12)])
            row = "| " + " | ".join(row_parts) + " |"
            mdx_lines.append(row)

        # Add spacing between providers
        mdx_lines.extend(["", "---", ""])

    # Write the MDX file
    print(f"💾 Writing MDX report to: {output_file}")
    with open(output_file, "w") as f:
        f.write("\n".join(mdx_lines))

    print(f"✅ Model sweep report saved to {output_file}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python generate_model_sweep_markdown.py <global_config_file> [output_file]")
        print("Example: python generate_model_sweep_markdown.py global_models_config_detailed.json supported-models.mdx")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "supported-models.mdx"

    # Handle relative paths by resolving them relative to the script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))

    if not os.path.isabs(input_file):
        input_file = os.path.join(script_dir, input_file)

    if not os.path.isabs(output_file):
        output_file = os.path.join(script_dir, output_file)

    try:
        process_global_models_config(input_file, output_file)
    except FileNotFoundError:
        print(f"❌ Error: Could not find input file '{input_file}'")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"❌ Error: Invalid JSON in file '{input_file}'")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
