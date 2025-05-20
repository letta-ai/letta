"""Configuration and validation for webhook functionality."""

import os
import re
from typing import Optional, Tuple
from urllib.parse import urlparse

from .constants import ENV_WEBHOOK_URL, ENV_WEBHOOK_TOKEN

def validate_webhook_url(url: str) -> Tuple[bool, Optional[str]]:
    """Validate a webhook URL.
    
    Args:
        url: The URL to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not url:
        return False, "Webhook URL cannot be empty"
        
    try:
        result = urlparse(url)
        if not all([result.scheme, result.netloc]):
            return False, "Invalid URL format"
            
        if result.scheme not in ("http", "https"):
            return False, "Only http and https URLs are supported"
            
        return True, None
    except Exception as e:
        return False, f"Invalid URL: {str(e)}"

def get_webhook_config() -> Tuple[Optional[str], Optional[str]]:
    """Get webhook configuration from environment variables.
    
    Returns:
        Tuple of (webhook_url, webhook_token)
    """
    webhook_url = os.getenv(ENV_WEBHOOK_URL)
    webhook_token = os.getenv(ENV_WEBHOOK_TOKEN, "")
    
    if not webhook_url:
        return None, None
        
    is_valid, error = validate_webhook_url(webhook_url)
    if not is_valid:
        print(f"Warning: {error}. Webhook functionality will be disabled.")
        return None, None
        
    return webhook_url, webhook_token

def is_webhook_enabled() -> bool:
    """Check if webhook functionality is enabled."""
    return bool(os.getenv(ENV_WEBHOOK_URL))
