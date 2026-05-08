"""
Letta Configuration File Support

Loads hierarchical YAML config and maps it to environment variables.

Supported top-level keys and their env var prefixes:
    letta:      -> LETTA_*
    model:      -> * (provider-prefixed: OPENAI_*, ANTHROPIC_*, etc.)
    tool:       -> * (prefix-based: E2B_*, MCP_*, TOOL_*, etc.)
    datadog:    -> DD_*

Config file format:
    letta:
        telemetry:
            enable_datadog: true
        pg:
            host: localhost
    model:
        openai:
            api_key: sk-xxx
        anthropic:
            api_key: sk-yyy
    tool:
        e2b:
            api_key: xxx
        mcp:
            disable_stdio: true
    datadog:
        site: us5.datadoghq.com
        service: memgpt-server

This maps to environment variables:
    LETTA_TELEMETRY_ENABLE_DATADOG=true
    LETTA_PG_HOST=localhost
    OPENAI_API_KEY=sk-xxx
    ANTHROPIC_API_KEY=sk-yyy
    E2B_API_KEY=xxx
    MCP_DISABLE_STDIO=true
    DD_SITE=us5.datadoghq.com
    DD_SERVICE=memgpt-server

Config file locations (in order of precedence):
    1. ~/.letta/conf.yaml
    2. ./conf.yaml
    3. LETTA_CONFIG_PATH environment variable
"""

import os
from pathlib import Path
from typing import Any

import yaml

# Config file locations
DEFAULT_USER_CONFIG = Path.home() / ".letta" / "conf.yaml"
DEFAULT_PROJECT_CONFIG = Path.cwd() / "conf.yaml"


def load_config_file(config_path: str | Path | None = None) -> dict[str, Any]:
    """
    Load configuration from YAML file.

    Args:
        config_path: Optional explicit path to config file

    Returns:
        Loaded config dict, or empty dict if no config found
    """
    paths_to_check = []

    # Check in order of precedence (lowest to highest)
    if DEFAULT_USER_CONFIG.exists():
        paths_to_check.append(DEFAULT_USER_CONFIG)

    if DEFAULT_PROJECT_CONFIG.exists():
        paths_to_check.append(DEFAULT_PROJECT_CONFIG)

    # Environment variable override
    env_path = os.environ.get("LETTA_CONFIG_PATH")
    if env_path and Path(env_path).exists():
        paths_to_check.append(Path(env_path))

    # Explicit path has highest precedence
    if config_path:
        p = Path(config_path)
        if p.exists():
            paths_to_check.append(p)

    # Merge configs (later files override earlier)
    config: dict[str, Any] = {}
    for path in paths_to_check:
        try:
            with open(path, "r") as f:
                file_config = yaml.safe_load(f)
                if file_config:
                    config = _deep_merge(config, file_config)
        except Exception:
            pass

    return config


def _deep_merge(base: dict, override: dict) -> dict:
    """Deep merge two dicts, override values take precedence."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _flatten_with_prefix(d: dict, prefix: str, env_vars: dict[str, str]) -> None:
    """Flatten a dict with a given prefix."""
    for key, value in d.items():
        env_key = f"{prefix}_{key}".upper() if prefix else key.upper()
        if isinstance(value, dict):
            _flatten_with_prefix(value, env_key, env_vars)
        elif value is not None:
            if isinstance(value, bool):
                env_vars[env_key] = str(value).lower()
            else:
                env_vars[env_key] = str(value)


def _flatten_model_settings(d: dict, env_vars: dict[str, str]) -> None:
    """
    Flatten model settings where nested keys become prefixes.

    model:
        openai:
            api_key: xxx     -> OPENAI_API_KEY
            api_base: yyy    -> OPENAI_API_BASE
        anthropic:
            api_key: zzz     -> ANTHROPIC_API_KEY
        global_max_context_window_limit: 128000  -> GLOBAL_MAX_CONTEXT_WINDOW_LIMIT
    """
    for key, value in d.items():
        if isinstance(value, dict):
            # Nested provider config: openai.api_key -> OPENAI_API_KEY
            _flatten_with_prefix(value, key.upper(), env_vars)
        elif value is not None:
            # Top-level model setting
            env_key = key.upper()
            if isinstance(value, bool):
                env_vars[env_key] = str(value).lower()
            else:
                env_vars[env_key] = str(value)


def _flatten_tool_settings(d: dict, env_vars: dict[str, str]) -> None:
    """
    Flatten tool settings where nested keys become prefixes.

    tool:
        e2b:
            api_key: xxx           -> E2B_API_KEY
            sandbox_template_id: y -> E2B_SANDBOX_TEMPLATE_ID
        mcp:
            disable_stdio: true    -> MCP_DISABLE_STDIO
        tool_sandbox_timeout: 180  -> TOOL_SANDBOX_TIMEOUT
    """
    for key, value in d.items():
        if isinstance(value, dict):
            # Nested tool config: e2b.api_key -> E2B_API_KEY
            _flatten_with_prefix(value, key.upper(), env_vars)
        elif value is not None:
            # Top-level tool setting
            env_key = key.upper()
            if isinstance(value, bool):
                env_vars[env_key] = str(value).lower()
            else:
                env_vars[env_key] = str(value)


def config_to_env_vars(config: dict[str, Any]) -> dict[str, str]:
    """
    Convert hierarchical config to flat environment variables.

    Supports multiple top-level keys with different prefix behaviors:
        - letta: -> LETTA_* prefix
        - model: -> provider-prefixed (OPENAI_*, ANTHROPIC_*, etc.)
        - tool:  -> prefix-based (E2B_*, MCP_*, TOOL_*, etc.)
        - datadog: -> DD_* prefix

    Args:
        config: Hierarchical config dict

    Returns:
        Dict of environment variable name -> value
    """
    env_vars: dict[str, str] = {}

    # Handle 'letta' section with LETTA_ prefix
    if "letta" in config:
        _flatten_with_prefix(config["letta"], "LETTA", env_vars)

    # Handle 'model' section (provider-prefixed env vars)
    if "model" in config:
        _flatten_model_settings(config["model"], env_vars)

    # Handle 'tool' section (prefix-based env vars)
    if "tool" in config:
        _flatten_tool_settings(config["tool"], env_vars)

    # Handle 'datadog' section with DD_ prefix
    if "datadog" in config:
        _flatten_with_prefix(config["datadog"], "DD", env_vars)

    return env_vars


def apply_config_to_env(config_path: str | Path | None = None) -> None:
    """
    Load config file and apply values to environment variables.

    Environment variables already set take precedence over config file values.

    Args:
        config_path: Optional explicit path to config file
    """
    config = load_config_file(config_path)
    if not config:
        return

    env_vars = config_to_env_vars(config)

    for key, value in env_vars.items():
        # Only set if not already in environment (env vars take precedence)
        if key not in os.environ:
            os.environ[key] = value
