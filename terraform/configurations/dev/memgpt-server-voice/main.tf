terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/dev/memgpt-server-voice"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
    }
  }
}

locals {
  env = "dev"
  region = "us-central1"
  service = "memgpt-server-voice"
}

provider "google" {
  project = "memgpt-428419"
  region  = local.region
}

# Get project information
data "google_project" "project" {}

# Create a dedicated GCP service account for memgpt-server-voice
resource "google_service_account" "memgpt_server_voice_sa" {
  account_id   = "memgpt-server-voice-${local.env}-sa"
  display_name = "MemGPT Server Voice Service Account in ${local.env}"
  description  = "Service account for memgpt-server-voice in ${local.env} environment"
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

  sa_email = google_service_account.memgpt_server_voice_sa.email
  sa_name  = google_service_account.memgpt_server_voice_sa.name

  # Set of secrets this service needs access to
  # TODO: Also, trigger the apply of service config when there's a new server

  secret_names = [
    for secret in data.terraform_remote_state.secrets.outputs.secrets_names :
    join("_", slice(split("_", secret), 2, length(split("_", secret)))) if length(split("_", secret)) >= 3 &&
    split("_", secret)[0] == local.env &&
    split("_", secret)[1] == local.service
  ]
}
