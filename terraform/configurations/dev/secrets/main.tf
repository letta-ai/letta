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

locals {
  secrets = {
    # "dev_service_secret-name" = var.dev_service_secret_name
    "dev_ci_gh-app-id"               = var.dev_ci_gh_app_id
    "dev_ci_gh-app-private-key" = var.dev_ci_gh_app_private_key
    "dev_ci_webhook-secret"          = var.dev_ci_webhook_secret
  }
}

provider "google" {
  project = "memgpt-428419"
  region  = "us-central1"
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

}
