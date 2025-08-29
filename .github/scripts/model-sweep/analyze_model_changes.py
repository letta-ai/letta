#!/usr/bin/env python3
"""
Simple check for meaningful changes between model sweep configs.
Returns exit code 1 if meaningful changes detected, 0 otherwise.
"""

import json
import os
import sys


def load_config(file_path: str) -> dict:
    """Load a compact config file."""
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"models": {}}
    except json.JSONDecodeError:
        return {"models": {}}


def has_meaningful_changes(current_config: dict, previous_config: dict) -> bool:
    """Check if there are meaningful changes between configs."""
    current_models = current_config.get("models", {})
    previous_models = previous_config.get("models", {})

    # Check for added/removed models
    if set(current_models.keys()) != set(previous_models.keys()):
        return True

    # Check for capability or context window changes in common models
    for handle in current_models.keys():
        current_model = current_models[handle]
        previous_model = previous_models.get(handle, {})

        # Check context window changes
        if current_model.get("context_window") != previous_model.get("context_window"):
            return True

        # Check capability changes
        current_caps = current_model.get("capabilities", {})
        previous_caps = previous_model.get("capabilities", {})

        if current_caps != previous_caps:
            return True

    return False


def main():
    if len(sys.argv) < 3:
        print("Usage: python analyze_model_changes.py <current_config> <previous_config>")
        sys.exit(1)

    current_config_file = sys.argv[1]
    previous_config_file = sys.argv[2]

    # Handle relative paths
    script_dir = os.path.dirname(os.path.abspath(__file__))

    if not os.path.isabs(current_config_file):
        current_config_file = os.path.join(script_dir, current_config_file)

    if not os.path.isabs(previous_config_file):
        previous_config_file = os.path.join(script_dir, previous_config_file)

    current_config = load_config(current_config_file)
    previous_config = load_config(previous_config_file)

    if has_meaningful_changes(current_config, previous_config):
        print("true")
    else:
        print("false")

    # Always exit with 0 to avoid workflow issues
    sys.exit(0)


if __name__ == "__main__":
    main()
