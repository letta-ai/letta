"""Constants for Venice AI integration."""

# Base URL for Venice AI API
VENICE_API_BASE = "https://api.venice.ai"

# Default model endpoint
VENICE_DEFAULT_ENDPOINT = f"{VENICE_API_BASE}/api/v1"

# Supported models
VENICE_SUPPORTED_MODELS = [
    "llama-3.3-70b",
    "mistral-31-24b",
    # Add other supported models as needed
]

# Default parameters for Venice AI
VENICE_DEFAULT_PARAMS = {
    "temperature": 0.7,
    "max_completion_tokens": 2048,
    "venice_parameters": {
        "include_venice_system_prompt": True,
        "enable_web_search": "auto",
    }
}

# Error codes from Venice AI API
VENICE_ERROR_CODES = {
    "AUTHENTICATION_FAILED": "Invalid or missing API key",
    "AUTHENTICATION_FAILED_INACTIVE_KEY": "API key is valid but subscription has lapsed",
    "UNAUTHORIZED": "API key does not have permission to access this resource",
    "MODEL_NOT_FOUND": "Specified model does not exist",
    "CHARACTER_NOT_FOUND": "Specified character persona does not exist",
    "INVALID_REQUEST": "Request parameters are invalid",
    "RATE_LIMIT_EXCEEDED": "Rate limit has been exceeded",
    "INFERENCE_FAILED": "Model inference failed",
    "UNKNOWN_ERROR": "An unknown error occurred",
} 