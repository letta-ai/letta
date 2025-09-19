variable "prod_ci_gh_app_id" {
  description = "GitHub App ID for CI integration"
  type        = string
  sensitive   = true
}
variable "prod_ci_gh_app_private_key" {
  description = "GitHub App private key for CI integration"
  type    = string
  sensitive = true
}
variable "prod_ci_webhook_secret" {
  description = "Webhook secret for CI integration (needs upload to Github app)"
  type        = string
  sensitive   = true
}

# variable "prod_ci_ANTHROPIC_API_KEY" {
#   description = "Anthropic API Key for prod CI"
#   type        = string
#   sensitive   = true
# }

# variable "prod_ci_AZURE_API_KEY" {
#   description = "Azure API Key for prod CI"
#   type        = string
#   sensitive   = true
# }

# variable "prod_ci_COMPOSIO_API_KEY" {
#   description = "Composio API Key for prod CI"
#   type        = string
#   sensitive   = true
# }

# variable "prod_ci_DEEPSEEK_API_KEY" {
#   description = "DeepSeek API Key for prod CI"
#   type        = string
#   sensitive   = true
# }
# variable "prod_ci_E2B_ACCESS_TOKEN" {
#   description = "E2B Access Token for prod CI"
#   type        = string
#   sensitive   = true
# }

# variable "prod_ci_E2B_API_KEY" {
#   description = "E2B API Key for prod CI"
#   type        = string
#   sensitive   = true
# }

# variable "prod_ci_GEMINI_API_KEY" {
#   description = "Gemini API Key for prod CI"
#   type        = string
#   sensitive   = true
# }

# variable "prod_ci_GROK_API_KEY" {
#   description = "Grok API Key for prod CI"
#   type        = string
#   sensitive   = true
# }

# variable "prod_ci_GROQ_API_KEY" {
#   description = "Groq API Key for prod CI"
#   type        = string
#   sensitive   = true
# }

# variable "prod_ci_OPENAI_API_KEY" {
#   description = "OpenAI API Key for prod CI"
#   type        = string
#   sensitive   = true
# }

# variable "prod_ci_SERPAPI_API_KEY" {
#   description = "SerpApi API Key for prod CI"
#   type        = string
#   sensitive   = true
# }

# variable "prod_ci_TOGETHER_API_KEY" {
#   description = "Together API Key for prod CI"
#   type        = string
#   sensitive   = true
# }

# variable "prod_model_proxy_OPENAI_API_KEY" {
#   description = "OpenAI API key for model-proxy"
#   type        = string
#   sensitive   = true
# }

# cloud-api secrets
variable "prod_cloud_api_voice_OPENAI_API_KEY" {
  description = "OpenAI API Key for cloud-api service"
  type        = string
  sensitive   = true
}

variable "prod_cloud_api_voice_SENTRY_DSN" {
  description = "Sentry DSN for cloud-api service"
  type        = string
  sensitive   = true
}

variable "prod_cloud_api_voice_COMPOSIO_API_KEY" {
  description = "Composio API Key for cloud-api service"
  type        = string
  sensitive   = true
}

variable "prod_cloud_api_voice_TEMPORAL_LETTUCE_CA_PEM" {
  description = "Temporal Lettuce CA PEM for cloud-api service"
  type        = string
  sensitive   = true
}

variable "prod_cloud_api_voice_TEMPORAL_LETTUCE_CA_KEY" {
  description = "Temporal Lettuce CA Key for cloud-api service"
  type        = string
  sensitive   = true
}

variable "prod_cloud_api_voice_LAUNCH_DARKLY_SDK_KEY" {
  description = "Launch Darkly SDK Key for cloud-api service"
  type        = string
  sensitive   = true
}

variable "prod_cloud_api_voice_STRIPE_WEBHOOK_SECRET" {
  description = "Stripe webhook secret for cloud-api service"
  type        = string
  sensitive   = true
}

variable "prod_cloud_api_voice_STRIPE_SECRET_KEY" {
  description = "Stripe secret key for cloud-api service"
  type        = string
  sensitive   = true
}

variable "prod_cloud_api_voice_CLICKHOUSE_PASSWORD" {
  description = "Clickhouse password for cloud-api service"
  type        = string
  sensitive   = true
}

variable "prod_cloud_api_voice_LETTA_PG_PASSWORD" {
  description = "Postgres password for cloud-api service"
  type        = string
  sensitive   = true
}

variable "prod_cloud_api_voice_DATABASE_URL" {
  description = "Database URL for cloud-api service"
  type        = string
  sensitive   = true
}

# memgpt-server secrets
variable "prod_memgpt_server_voice_LETTA_SERVER_PASS" {
  description = "Server password for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "prod_memgpt_server_voice_LETTA_PG_PASSWORD" {
  description = "Postgres password for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "prod_memgpt_server_voice_OPENAI_API_KEY" {
  description = "OpenAI API Key for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "prod_memgpt_server_voice_TOGETHER_API_KEY" {
  description = "Together API Key for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "prod_memgpt_server_voice_ANTHROPIC_API_KEY" {
  description = "Anthropic API Key for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "prod_memgpt_server_voice_E2B_API_KEY" {
  description = "E2B API Key for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "prod_memgpt_server_voice_E2B_SANDBOX_TEMPLATE_ID" {
  description = "E2B Sandbox Template ID for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "prod_memgpt_server_voice_SENTRY_DSN" {
  description = "Sentry DSN for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "prod_memgpt_server_voice_CLICKHOUSE_PASSWORD" {
  description = "Clickhouse password for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "prod_memgpt_server_voice_COMPOSIO_API_KEY" {
  description = "Composio API Key for memgpt-server service"
  type        = string
  sensitive   = true
}
variable "prod_memgpt_server_voice_GEMINI_API_KEY" {
  description = "Gemini API Key for memgpt-server service"
  type        = string
  sensitive   = true
}
variable "prod_memgpt_server_voice_TAVILY_API_KEY" {
  description = "Tavily API Key for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "prod_memgpt_server_LETTA_TPUF_API_KEY" {
  description = "Turbopuffer API Key for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "prod_memgpt_server_LETTA_ENCRYPTION_KEY" {
  description = "Encryption key for memgpt-server service"
  type        = string
  sensitive   = true
}

# lettuce-py secrets
variable "prod_lettuce_py_LETTA_PG_URI" {
  description = "Database URI for lettuce-py service"
  type        = string
  sensitive   = true
}

variable "prod_lettuce_py_LETTA_TEMPORAL_API_KEY" {
   description = "Temporal API key for lettuce-py service"
   type        = string
   sensitive   = true
 }
variable "prod_lettuce_py_OPENAI_API_KEY" {
   description = "OpenAI API key for lettuce-py service"
   type        = string
   sensitive   = true
 }
variable "prod_lettuce_py_ANTHROPIC_API_KEY" {
   description = "Anthropic API key for lettuce-py service"
   type        = string
   sensitive   = true
 }
variable "prod_lettuce_py_E2B_API_KEY" {
   description = "E2B API key for lettuce-py service"
   type        = string
   sensitive   = true
 }
