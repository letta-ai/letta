terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/prod/secrets"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = "memgpt-428419"
  region  = "us-central1"
}

locals {
  secrets = {
    # # "prod_service_secret-name" = var.prod_service_secret_name
    "prod_ci_gh-app-id"           = var.prod_ci_gh_app_id
    "prod_ci_gh-app-private-key"  = var.prod_ci_gh_app_private_key
    "prod_ci_webhook-secret"      = var.prod_ci_webhook_secret

    # # Prod CI API Keys
    # "prod_ci_ANTHROPIC_API_KEY"   = var.prod_ci_ANTHROPIC_API_KEY
    # "prod_ci_AZURE_API_KEY"       = var.prod_ci_AZURE_API_KEY
    # "prod_ci_DEEPSEEK_API_KEY"    = var.prod_ci_DEEPSEEK_API_KEY
    # "prod_ci_E2B_ACCESS_TOKEN"    = var.prod_ci_E2B_ACCESS_TOKEN
    # "prod_ci_E2B_API_KEY"         = var.prod_ci_E2B_API_KEY
    # "prod_ci_GEMINI_API_KEY"      = var.prod_ci_GEMINI_API_KEY
    # "prod_ci_GROK_API_KEY"        = var.prod_ci_GROK_API_KEY
    # "prod_ci_GROQ_API_KEY"        = var.prod_ci_GROQ_API_KEY
    # "prod_ci_OPENAI_API_KEY"      = var.prod_ci_OPENAI_API_KEY
    # "prod_ci_SERPAPI_API_KEY"     = var.prod_ci_SERPAPI_API_KEY
    # "prod_ci_TOGETHER_API_KEY"    = var.prod_ci_TOGETHER_API_KEY

    # # model-proxy secrets
    # "prod_model-proxy_OPENAI_API_KEY" = var.prod_model_proxy_OPENAI_API_KEY

    # cloud-api secrets
    "prod_cloud-api-voice_OPENAI_API_KEY" = var.prod_cloud_api_voice_OPENAI_API_KEY
    "prod_cloud-api-voice_TEMPORAL_LETTUCE_CA_PEM" = var.prod_cloud_api_voice_TEMPORAL_LETTUCE_CA_PEM
    "prod_cloud-api-voice_TEMPORAL_LETTUCE_CA_KEY" = var.prod_cloud_api_voice_TEMPORAL_LETTUCE_CA_KEY
    "prod_cloud-api-voice_LAUNCH_DARKLY_SDK_KEY" = var.prod_cloud_api_voice_LAUNCH_DARKLY_SDK_KEY
    "prod_cloud-api-voice_STRIPE_WEBHOOK_SECRET" = var.prod_cloud_api_voice_STRIPE_WEBHOOK_SECRET
    "prod_cloud-api-voice_STRIPE_SECRET_KEY" = var.prod_cloud_api_voice_STRIPE_SECRET_KEY
    "prod_cloud-api-voice_SENTRY_DSN" = var.prod_cloud_api_voice_SENTRY_DSN
    "prod_cloud-api-voice_CLICKHOUSE_PASSWORD" = var.prod_cloud_api_voice_CLICKHOUSE_PASSWORD
    "prod_cloud-api-voice_LETTA_PG_PASSWORD" = var.prod_cloud_api_voice_LETTA_PG_PASSWORD
    "prod_cloud-api-voice_DATABASE_URL" = var.prod_cloud_api_voice_DATABASE_URL


    # credit-undertaker secrets (uncomment as needed)
    # "prod_credit-undertaker_LETTA_PG_USER" = var.prod_credit_undertaker_LETTA_PG_USER
    # "prod_credit-undertaker_LETTA_PG_PASSWORD" = var.prod_credit_undertaker_LETTA_PG_PASSWORD
    # "prod_credit-undertaker_LETTA_PG_DB" = var.prod_credit_undertaker_LETTA_PG_DB
    # "prod_credit-undertaker_DATABASE_URL" = var.prod_credit_undertaker_DATABASE_URL
    # "prod_credit-undertaker_STRIPE_SECRET_KEY" = var.prod_credit_undertaker_STRIPE_SECRET_KEY
    # "prod_credit-undertaker_RESEND_API_KEY" = var.prod_credit_undertaker_RESEND_API_KEY

    # letta-web secrets (uncomment as needed)
    # "prod_letta-web_DATABASE_URL" = var.prod_letta_web_DATABASE_URL
    # "prod_letta-web_GOOGLE_CLIENT_ID" = var.prod_letta_web_GOOGLE_CLIENT_ID
    # "prod_letta-web_GOOGLE_CLIENT_SECRET" = var.prod_letta_web_GOOGLE_CLIENT_SECRET
    # "prod_letta-web_E2B_SANDBOX_TEMPLATE_ID" = var.prod_letta_web_E2B_SANDBOX_TEMPLATE_ID
    # "prod_letta-web_E2B_API_KEY" = var.prod_letta_web_E2B_API_KEY
    # "prod_letta-web_HUBSPOT_API_KEY" = var.prod_letta_web_HUBSPOT_API_KEY
    # "prod_letta-web_RESEND_API_KEY" = var.prod_letta_web_RESEND_API_KEY

    # lettuce secrets (uncomment as needed)
    # "prod_lettuce_DATABASE_URL" = var.prod_lettuce_DATABASE_URL
    # "prod_lettuce_TEMPORAL_LETTUCE_API_HOST" = var.prod_lettuce_TEMPORAL_LETTUCE_API_HOST
    # "prod_lettuce_TEMPORAL_LETTUCE_CA_PEM" = var.prod_lettuce_TEMPORAL_LETTUCE_CA_PEM
    # "prod_lettuce_TEMPORAL_LETTUCE_CA_KEY" = var.prod_lettuce_TEMPORAL_LETTUCE_CA_KEY
    # "prod_lettuce_RESEND_API_KEY" = var.prod_lettuce_RESEND_API_KEY

    # lettuce-py secrets
    "prod_lettuce-py_LETTA_PG_URI" = var.prod_lettuce_py_LETTA_PG_URI
    "prod_lettuce-py_LETTA_TEMPORAL_API_KEY" = var.prod_lettuce_py_LETTA_TEMPORAL_API_KEY
    "prod_lettuce-py_LETTA_TEMPORAL_PRIVATE_KEY" = var.prod_lettuce_py_LETTA_TEMPORAL_PRIVATE_KEY
    "prod_lettuce-py_LETTA_TEMPORAL_CLIENT_CERTIFICATE" = var.prod_lettuce_py_LETTA_TEMPORAL_CLIENT_CERTIFICATE
    "prod_lettuce-py_OPENAI_API_KEY" = var.prod_lettuce_py_OPENAI_API_KEY
    "prod_lettuce-py_ANTHROPIC_API_KEY" = var.prod_lettuce_py_ANTHROPIC_API_KEY
    "prod_lettuce-py_E2B_API_KEY" = var.prod_lettuce_py_E2B_API_KEY

    # memgpt-server secrets
    "prod_memgpt-server-voice_LETTA_SERVER_PASS" = var.prod_memgpt_server_voice_LETTA_SERVER_PASS
    "prod_memgpt-server-voice_LETTA_PG_PASSWORD" = var.prod_memgpt_server_voice_LETTA_PG_PASSWORD
    "prod_memgpt-server-voice_OPENAI_API_KEY" = var.prod_memgpt_server_voice_OPENAI_API_KEY
    "prod_memgpt-server-voice_TOGETHER_API_KEY" = var.prod_memgpt_server_voice_TOGETHER_API_KEY
    "prod_memgpt-server-voice_ANTHROPIC_API_KEY" = var.prod_memgpt_server_voice_ANTHROPIC_API_KEY
    "prod_memgpt-server-voice_E2B_API_KEY" = var.prod_memgpt_server_voice_E2B_API_KEY
    "prod_memgpt-server-voice_E2B_SANDBOX_TEMPLATE_ID" = var.prod_memgpt_server_voice_E2B_SANDBOX_TEMPLATE_ID
    "prod_memgpt-server-voice_SENTRY_DSN" = var.prod_memgpt_server_voice_SENTRY_DSN
    "prod_memgpt-server-voice_CLICKHOUSE_PASSWORD" = var.prod_memgpt_server_voice_CLICKHOUSE_PASSWORD
    "prod_memgpt-server-voice_GEMINI_API_KEY" = var.prod_memgpt_server_voice_GEMINI_API_KEY
    "prod_memgpt-server-voice_TAVILY_API_KEY" = var.prod_memgpt_server_voice_TAVILY_API_KEY

    "prod_memgpt-server_LETTA_TPUF_API_KEY" = var.prod_memgpt_server_LETTA_TPUF_API_KEY
    "prod_memgpt-server_LETTA_ENCRYPTION_KEY" = var.prod_memgpt_server_LETTA_ENCRYPTION_KEY
  }

  # create the secret but leave the value empty
  create_only_secrets = [
    # "prod_e2b_E2B_SANDBOX_TEMPLATE_ID",
    # "prod_ci_E2B_SANDBOX_TEMPLATE_ID",
  ]
}

# Reference to the secrets module
module "secrets" {
  source = "../../../modules/secrets"

  env = "prod"
  region = "us-central1"

  # Secrets map where keys are the fully qualified secret names (env_service_secretname)
  # Values come from 1Password
  secrets = local.secrets
  secret_names = keys(local.secrets)
  create_only_secrets = local.create_only_secrets
}
