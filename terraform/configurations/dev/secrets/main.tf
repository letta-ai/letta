terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/dev/secrets"
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
    # "dev_service_secret-name" = var.dev_service_secret_name
    "dev_ci_gh-app-id"           = var.dev_ci_gh_app_id
    "dev_ci_gh-app-private-key"  = var.dev_ci_gh_app_private_key
    "dev_ci_webhook-secret"      = var.dev_ci_webhook_secret

    # Dev CI API Keys
    "dev_ci_ANTHROPIC_API_KEY"   = var.dev_ci_ANTHROPIC_API_KEY
    "dev_ci_AZURE_API_KEY"       = var.dev_ci_AZURE_API_KEY
    "dev_ci_COMPOSIO_API_KEY"    = var.dev_ci_COMPOSIO_API_KEY
    "dev_ci_DEEPSEEK_API_KEY"    = var.dev_ci_DEEPSEEK_API_KEY
    "dev_ci_E2B_ACCESS_TOKEN"    = var.dev_ci_E2B_ACCESS_TOKEN
    "dev_ci_E2B_API_KEY"         = var.dev_ci_E2B_API_KEY
    "dev_ci_GEMINI_API_KEY"      = var.dev_ci_GEMINI_API_KEY
    "dev_ci_GROK_API_KEY"        = var.dev_ci_GROK_API_KEY
    "dev_ci_GROQ_API_KEY"        = var.dev_ci_GROQ_API_KEY
    "dev_ci_OPENAI_API_KEY"      = var.dev_ci_OPENAI_API_KEY
    "dev_ci_SERPAPI_API_KEY"     = var.dev_ci_SERPAPI_API_KEY
    "dev_ci_TOGETHER_API_KEY"    = var.dev_ci_TOGETHER_API_KEY
    "dev_ci_EXA_API_KEY"         = var.dev_ci_EXA_API_KEY
    "dev_ci_LETTA_API_KEY"       = var.dev_ci_LETTA_API_KEY
    "dev_ci_LETTA_TPUF_API_KEY" = var.dev_ci_LETTA_TPUF_API_KEY

    "dev_ci_DD_API_KEY" = var.dev_ci_DD_API_KEY

    # Cypress test secrets
    "dev_cypress_ANTHROPIC_API_KEY"      = var.dev_cypress_ANTHROPIC_API_KEY
    "dev_cypress_OPENAI_API_KEY"         = var.dev_cypress_OPENAI_API_KEY
    "dev_cypress_GEMINI_API_KEY"         = var.dev_cypress_GEMINI_API_KEY
    "dev_cypress_BEDROCK_API_KEY"        = var.dev_cypress_BEDROCK_API_KEY
    "dev_cypress_BEDROCK_ACCESS_KEY_ID"  = var.dev_cypress_BEDROCK_ACCESS_KEY_ID
    "dev_cypress_BEDROCK_ACCESS_KEY"     = var.dev_cypress_BEDROCK_ACCESS_KEY
    "dev_cypress_AZURE_API_KEY"          = var.dev_cypress_AZURE_API_KEY
    "dev_cypress_AZURE_BASE_URL"         = var.dev_cypress_AZURE_BASE_URL
    "dev_cypress_AZURE_API_VERSION"      = var.dev_cypress_AZURE_API_VERSION
    "dev_cypress_TOGETHER_API_KEY"       = var.dev_cypress_TOGETHER_API_KEY


    # cloud-api secrets
    "dev_cloud-api_OPENAI_API_KEY" = var.dev_cloud_api_OPENAI_API_KEY
    "dev_cloud-api_COMPOSIO_API_KEY" = var.dev_cloud_api_COMPOSIO_API_KEY
    "dev_cloud-api_TEMPORAL_LETTUCE_CA_PEM" = var.dev_cloud_api_TEMPORAL_LETTUCE_CA_PEM
    "dev_cloud-api_TEMPORAL_LETTUCE_CA_KEY" = var.dev_cloud_api_TEMPORAL_LETTUCE_CA_KEY
    "dev_cloud-api_LAUNCH_DARKLY_SDK_KEY" = var.dev_cloud_api_LAUNCH_DARKLY_SDK_KEY
    "dev_cloud-api_STRIPE_WEBHOOK_SECRET" = var.dev_cloud_api_STRIPE_WEBHOOK_SECRET
    "dev_cloud-api_STRIPE_SECRET_KEY" = var.dev_cloud_api_STRIPE_SECRET_KEY
    "dev_cloud-api_SENTRY_DSN" = var.dev_cloud_api_SENTRY_DSN
    "dev_cloud-api_CLICKHOUSE_PASSWORD" = var.dev_cloud_api_CLICKHOUSE_PASSWORD
    "dev_cloud-api_LETTA_PG_PASSWORD" = var.dev_cloud_api_LETTA_PG_PASSWORD
    "dev_cloud-api_DATABASE_URL" = var.dev_cloud_api_DATABASE_URL
    # credit-undertaker secrets
    # "dev_credit-undertaker_LETTA_PG_USER" = var.dev_credit_undertaker_LETTA_PG_USER
    "dev_credit-undertaker_LETTA_PG_PASSWORD" = var.dev_credit_undertaker_LETTA_PG_PASSWORD
    # "dev_credit-undertaker_LETTA_PG_DB" = var.dev_credit_undertaker_LETTA_PG_DB
    "dev_credit-undertaker_DATABASE_URL" = var.dev_credit_undertaker_DATABASE_URL
    "dev_credit-undertaker_STRIPE_SECRET_KEY" = var.dev_credit_undertaker_STRIPE_SECRET_KEY
    # "dev_credit-undertaker_RESEND_API_KEY" = var.dev_credit_undertaker_RESEND_API_KEY

    # letta-web secrets
    "dev_letta-web_DATABASE_URL" = var.dev_letta_web_DATABASE_URL
    "dev_letta-web_GOOGLE_CLIENT_ID" = var.dev_letta_web_GOOGLE_CLIENT_ID
    "dev_letta-web_GOOGLE_CLIENT_SECRET" = var.dev_letta_web_GOOGLE_CLIENT_SECRET
    "dev_letta-web_GOOGLE_REDIRECT_URI" = var.dev_letta_web_GOOGLE_REDIRECT_URI
    "dev_letta-web_STRIPE_SECRET_KEY" = var.dev_letta_web_STRIPE_SECRET_KEY
    "dev_letta-web_E2B_SANDBOX_TEMPLATE_ID" = var.dev_letta_web_E2B_SANDBOX_TEMPLATE_ID
    "dev_letta-web_E2B_API_KEY" = var.dev_letta_web_E2B_API_KEY
    # "dev_letta-web_HUBSPOT_API_KEY" = var.dev_letta_web_HUBSPOT_API_KEY
    # "dev_letta-web_RESEND_API_KEY" = var.dev_letta_web_RESEND_API_KEY
    "dev_letta-web_COMPOSIO_API_KEY" = var.dev_letta_web_COMPOSIO_API_KEY
    "dev_letta-web_POSTHOG_KEY" = var.dev_letta_web_POSTHOG_KEY
    "dev_letta-web_POSTHOG_HOST" = var.dev_letta_web_POSTHOG_HOST
    "dev_letta-web_NEXT_PUBLIC_POSTHOG_KEY" = var.dev_letta_web_NEXT_PUBLIC_POSTHOG_KEY

    # lettuce secrets
    "dev_lettuce_DATABASE_URL" = var.dev_lettuce_DATABASE_URL
    # "dev_lettuce_TEMPORAL_LETTUCE_API_HOST" = var.dev_lettuce_TEMPORAL_LETTUCE_API_HOST
    "dev_lettuce_TEMPORAL_LETTUCE_CA_PEM" = var.dev_lettuce_TEMPORAL_LETTUCE_CA_PEM
    "dev_lettuce_TEMPORAL_LETTUCE_CA_KEY" = var.dev_lettuce_TEMPORAL_LETTUCE_CA_KEY
    # "dev_lettuce_RESEND_API_KEY" = var.dev_lettuce_RESEND_API_KEY

    # lettuce-py secrets
    "dev_lettuce-py_LETTA_PG_URI" = var.dev_lettuce_py_LETTA_PG_URI
    "dev_lettuce-py_LETTA_TEMPORAL_API_KEY" = var.dev_lettuce_py_LETTA_TEMPORAL_API_KEY
    "dev_lettuce-py_OPENAI_API_KEY" = var.dev_lettuce_py_OPENAI_API_KEY
    "dev_lettuce-py_ANTHROPIC_API_KEY" = var.dev_lettuce_py_ANTHROPIC_API_KEY
    "dev_lettuce-py_E2B_API_KEY" = var.dev_lettuce_py_E2B_API_KEY

    # memgpt-server secrets
    "dev_memgpt-server_LETTA_SERVER_PASS" = var.dev_memgpt_server_LETTA_SERVER_PASS
    "dev_memgpt-server_LETTA_PG_PASSWORD" = var.dev_memgpt_server_LETTA_PG_PASSWORD
    "dev_memgpt-server_OPENAI_API_KEY" = var.dev_memgpt_server_OPENAI_API_KEY
    "dev_memgpt-server_TOGETHER_API_KEY" = var.dev_memgpt_server_TOGETHER_API_KEY
    "dev_memgpt-server_ANTHROPIC_API_KEY" = var.dev_memgpt_server_ANTHROPIC_API_KEY
    "dev_memgpt-server_E2B_API_KEY" = var.dev_memgpt_server_E2B_API_KEY
    "dev_memgpt-server_E2B_SANDBOX_TEMPLATE_ID" = var.dev_memgpt_server_E2B_SANDBOX_TEMPLATE_ID
    "dev_memgpt-server_SENTRY_DSN" = var.dev_memgpt_server_SENTRY_DSN
    "dev_memgpt-server_CLICKHOUSE_PASSWORD" = var.dev_memgpt_server_CLICKHOUSE_PASSWORD
    "dev_memgpt-server_LETTA_PG_URI" = var.dev_memgpt_server_LETTA_PG_URI
    "dev_memgpt-server_LETTA_PINECONE_API_KEY" = var.dev_memgpt_server_LETTA_PINECONE_API_KEY
    "dev_memgpt-server_LETTA_TPUF_API_KEY" = var.dev_memgpt_server_LETTA_TPUF_API_KEY
    "dev_memgpt-server_LETTA_ENCRYPTION_KEY" = var.dev_memgpt_server_LETTA_ENCRYPTION_KEY
    "dev_memgpt-server_COMPOSIO_API_KEY" = var.dev_memgpt_server_COMPOSIO_API_KEY
    "dev_memgpt-server_LETTA_TEMPORAL_API_KEY" = var.dev_memgpt_server_LETTA_TEMPORAL_API_KEY
    "dev_memgpt-server_LETTA_MISTRAL_API_KEY" = var.dev_memgpt_server_LETTA_MISTRAL_API_KEY

    # memgpt-server-voice secrets
    "dev_memgpt-server-voice_LETTA_SERVER_PASS" = var.dev_memgpt_server_voice_LETTA_SERVER_PASS
    "dev_memgpt-server-voice_LETTA_PG_PASSWORD" = var.dev_memgpt_server_voice_LETTA_PG_PASSWORD
    "dev_memgpt-server-voice_OPENAI_API_KEY" = var.dev_memgpt_server_voice_OPENAI_API_KEY
    "dev_memgpt-server-voice_TOGETHER_API_KEY" = var.dev_memgpt_server_voice_TOGETHER_API_KEY
    "dev_memgpt-server-voice_ANTHROPIC_API_KEY" = var.dev_memgpt_server_voice_ANTHROPIC_API_KEY
    "dev_memgpt-server-voice_E2B_API_KEY" = var.dev_memgpt_server_voice_E2B_API_KEY
    "dev_memgpt-server-voice_E2B_SANDBOX_TEMPLATE_ID" = var.dev_memgpt_server_voice_E2B_SANDBOX_TEMPLATE_ID
    "dev_memgpt-server-voice_SENTRY_DSN" = var.dev_memgpt_server_voice_SENTRY_DSN
    "dev_memgpt-server-voice_CLICKHOUSE_PASSWORD" = var.dev_memgpt_server_voice_CLICKHOUSE_PASSWORD

  }
  # create the secret but leave the value empty
  create_only_secrets = [
    "dev_e2b_E2B_SANDBOX_TEMPLATE_ID",
    "dev_ci_E2B_SANDBOX_TEMPLATE_ID",
  ]
}

# Reference to the secrets module
module "secrets" {
  source = "../../../modules/secrets"

  env = "dev"
  region = "us-central1"

  # Secrets map where keys are the fully qualified secret names (env_service_secretname)
  # Values come from 1Password
  secrets = local.secrets
  secret_names = keys(local.secrets)
  create_only_secrets = local.create_only_secrets

}
