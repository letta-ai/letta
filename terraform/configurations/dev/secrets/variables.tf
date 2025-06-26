variable "dev_ci_gh_app_id" {
  description = "GitHub App ID for CI integration"
  type        = string
  sensitive   = true
}
variable "dev_ci_gh_app_private_key" {
  description = "GitHub App private key for CI integration"
  type    = string
  sensitive = true
}
variable "dev_ci_webhook_secret" {
  description = "Webhook secret for CI integration (needs upload to Github app)"
  type        = string
  sensitive   = true
}

variable "dev_ci_ANTHROPIC_API_KEY" {
  description = "Anthropic API Key for dev CI"
  type        = string
  sensitive   = true
}

variable "dev_ci_AZURE_API_KEY" {
  description = "Azure API Key for dev CI"
  type        = string
  sensitive   = true
}

variable "dev_ci_COMPOSIO_API_KEY" {
  description = "Composio API Key for dev CI"
  type        = string
  sensitive   = true
}

variable "dev_ci_DEEPSEEK_API_KEY" {
  description = "DeepSeek API Key for dev CI"
  type        = string
  sensitive   = true
}
variable "dev_ci_E2B_ACCESS_TOKEN" {
  description = "E2B Access Token for dev CI"
  type        = string
  sensitive   = true
}

variable "dev_ci_E2B_API_KEY" {
  description = "E2B API Key for dev CI"
  type        = string
  sensitive   = true
}

variable "dev_ci_GEMINI_API_KEY" {
  description = "Gemini API Key for dev CI"
  type        = string
  sensitive   = true
}

variable "dev_ci_GROK_API_KEY" {
  description = "Grok API Key for dev CI"
  type        = string
  sensitive   = true
}

variable "dev_ci_GROQ_API_KEY" {
  description = "Groq API Key for dev CI"
  type        = string
  sensitive   = true
}

variable "dev_ci_OPENAI_API_KEY" {
  description = "OpenAI API Key for dev CI"
  type        = string
  sensitive   = true
}

variable "dev_ci_SERPAPI_API_KEY" {
  description = "SerpApi API Key for dev CI"
  type        = string
  sensitive   = true
}

variable "dev_ci_TOGETHER_API_KEY" {
  description = "Together API Key for dev CI"
  type        = string
  sensitive   = true
}

variable "dev_ci_FIRECRAWL_API_KEY" {
  description = "Firecrawl API Key for dev CI"
  type        = string
  sensitive   = true
}

variable "dev_model_proxy_OPENAI_API_KEY" {
  description = "OpenAI API key for model-proxy"
  type        = string
  sensitive   = true
}

# cloud-api secrets
variable "dev_cloud_api_OPENAI_API_KEY" {
  description = "OpenAI API Key for cloud-api service"
  type        = string
  sensitive   = true
}

variable "dev_cloud_api_SENTRY_DSN" {
  description = "Sentry DSN for cloud-api service"
  type        = string
  sensitive   = true
}

variable "dev_cloud_api_COMPOSIO_API_KEY" {
  description = "Composio API Key for cloud-api service"
  type        = string
  sensitive   = true
}

variable "dev_cloud_api_TEMPORAL_LETTUCE_CA_PEM" {
  description = "Temporal Lettuce CA PEM for cloud-api service"
  type        = string
  sensitive   = true
}

variable "dev_cloud_api_TEMPORAL_LETTUCE_CA_KEY" {
  description = "Temporal Lettuce CA Key for cloud-api service"
  type        = string
  sensitive   = true
}

variable "dev_cloud_api_LAUNCH_DARKLY_SDK_KEY" {
  description = "Launch Darkly SDK Key for cloud-api service"
  type        = string
  sensitive   = true
}

variable "dev_cloud_api_STRIPE_WEBHOOK_SECRET" {
  description = "Stripe webhook secret for cloud-api service"
  type        = string
  sensitive   = true
}

variable "dev_cloud_api_STRIPE_SECRET_KEY" {
  description = "Stripe secret key for cloud-api service"
  type        = string
  sensitive   = true
}

variable "dev_cloud_api_CLICKHOUSE_PASSWORD" {
  description = "Clickhouse password for cloud-api service"
  type        = string
  sensitive   = true
}

variable "dev_cloud_api_LETTA_PG_PASSWORD" {
  description = "Postgres password for cloud-api service"
  type        = string
  sensitive   = true
}

# # credit-undertaker secrets
# variable "dev_credit_undertaker_LETTA_PG_USER" {
#   description = "Postgres user for credit-undertaker service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_credit_undertaker_LETTA_PG_PASSWORD" {
#   description = "Postgres password for credit-undertaker service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_credit_undertaker_LETTA_PG_DB" {
#   description = "Postgres database name for credit-undertaker service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_credit_undertaker_DATABASE_URL" {
#   description = "Full database URL for credit-undertaker service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_credit_undertaker_STRIPE_SECRET_KEY" {
#   description = "Stripe secret key for credit-undertaker service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_credit_undertaker_RESEND_API_KEY" {
#   description = "Resend API key for credit-undertaker service"
#   type        = string
#   sensitive   = true
# }

# # letta-web secrets
# variable "dev_letta_web_DATABASE_URL" {
#   description = "Database URL for letta-web service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_letta_web_GOOGLE_CLIENT_ID" {
#   description = "Google OAuth Client ID for letta-web service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_letta_web_GOOGLE_CLIENT_SECRET" {
#   description = "Google OAuth Client Secret for letta-web service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_letta_web_E2B_SANDBOX_TEMPLATE_ID" {
#   description = "E2B Sandbox Template ID for letta-web service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_letta_web_E2B_API_KEY" {
#   description = "E2B API Key for letta-web service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_letta_web_HUBSPOT_API_KEY" {
#   description = "HubSpot API Key for letta-web service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_letta_web_RESEND_API_KEY" {
#   description = "Resend API Key for letta-web service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_letta_web_COMPOSIO_API_KEY" {
#   description = "Composio API Key for letta-web service"
#   type        = string
#   sensitive   = true
# }

# # lettuce secrets
# variable "dev_lettuce_DATABASE_URL" {
#   description = "Database URL for lettuce service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_lettuce_TEMPORAL_LETTUCE_API_HOST" {
#   description = "Temporal Lettuce API Host for lettuce service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_lettuce_TEMPORAL_LETTUCE_CA_PEM" {
#   description = "Temporal Lettuce CA PEM for lettuce service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_lettuce_TEMPORAL_LETTUCE_CA_KEY" {
#   description = "Temporal Lettuce CA Key for lettuce service"
#   type        = string
#   sensitive   = true
# }

# variable "dev_lettuce_RESEND_API_KEY" {
#   description = "Resend API Key for lettuce service"
#   type        = string
#   sensitive   = true
# }

# memgpt-server secrets
variable "dev_memgpt_server_OPENAI_API_KEY" {
  description = "OpenAI API Key for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_TOGETHER_API_KEY" {
  description = "Together API Key for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_LETTA_SERVER_PASS" {
  description = "MemGPT Server Password for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_ANTHROPIC_API_KEY" {
  description = "Anthropic API Key for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_E2B_SANDBOX_TEMPLATE_ID" {
  description = "E2B Sandbox Template ID for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_E2B_API_KEY" {
  description = "E2B API Key for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_SENTRY_DSN" {
  description = "Sentry DSN for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_LETTA_PG_PASSWORD" {
  description = "Postgres password for memgpt-server service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_CLICKHOUSE_PASSWORD" {
  description = "Clickhouse Password for memgpt-server service"
  type        = string
  sensitive   = true
}

# memgpt-server-voice secrets

variable "dev_memgpt_server_voice_OPENAI_API_KEY" {
  description = "OpenAI API Key for memgpt-server-voice service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_voice_COMPOSIO_API_KEY" {
  description = "Composio API Key for memgpt-server-voice service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_voice_GEMINI_API_KEY" {
  description = "Gemini API Key for memgpt-server-voice service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_voice_TAVILY_API_KEY" {
  description = "Tavily API Key for memgpt-server-voice service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_voice_TOGETHER_API_KEY" {
  description = "Together API Key for memgpt-server-voice service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_voice_ANTHROPIC_API_KEY" {
  description = "Anthropic API Key for memgpt-server-voice service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_voice_E2B_API_KEY" {
  description = "E2B API Key for memgpt-server-voice service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_voice_E2B_SANDBOX_TEMPLATE_ID" {
  description = "E2B Sandbox Template ID for memgpt-server-voice service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_voice_SENTRY_DSN" {
  description = "Sentry DSN for memgpt-server-voice service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_voice_CLICKHOUSE_PASSWORD" {
  description = "Clickhouse Password for memgpt-server-voice service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_voice_LETTA_PG_PASSWORD" {
  description = "Postgres password for memgpt-server-voice service"
  type        = string
  sensitive   = true
}

variable "dev_memgpt_server_voice_LETTA_SERVER_PASS" {
  description = "MemGPT Server Password for memgpt-server-voice service"
  type        = string
  sensitive   = true
}
