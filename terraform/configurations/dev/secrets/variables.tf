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
