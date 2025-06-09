terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/prod/cloud-api-voice"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
    }
  }
}

locals {
  env = "prod"
  region = "us-central1"
  service = "cloud-api-voice"
}

provider "google" {
  project = "memgpt-428419"
  region  = local.region
}

# Get project information
data "google_project" "project" {}

# Create a dedicated GCP service account for cloud-api-voice
resource "google_service_account" "cloud_api_voice_sa" {
  account_id   = "${local.service}-${local.env}-sa"
  display_name = "Cloud API Voice Service Account in ${local.env}"
  description  = "Service account for ${local.service} in ${local.env} environment"
}

# get output from secrets module
data "terraform_remote_state" "secrets" {
  backend = "gcs"
  config = {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/${local.env}/secrets"
  }
}

# Configure IAM permissions for the service account to access secrets
module "k8s-iam" {
  source = "../../../modules/k8s-iam"

  env         = local.env
  region      = local.region
  service     = local.service
  project_id  = data.google_project.project.project_id

  sa_email = google_service_account.cloud_api_voice_sa.email
  sa_name  = google_service_account.cloud_api_voice_sa.name

  # Set of secrets this service needs access to
  # Dynamic secret detection based on environment and service name
  secret_names = [
    for secret in data.terraform_remote_state.secrets.outputs.secrets_names :
    join("_", slice(split("_", secret), 2, length(split("_", secret)))) if length(split("_", secret)) >= 3 &&
    split("_", secret)[0] == local.env &&
    split("_", secret)[1] == local.service
  ]
}
