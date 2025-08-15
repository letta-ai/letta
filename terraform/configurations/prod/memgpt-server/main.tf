terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/prod/memgpt-server"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.30"
    }
  }
}

locals {
  env = "prod"
  region = "us-central1"
  service = "memgpt-server"
}

provider "google" {
  project = "memgpt-428419"
  region  = local.region
}

# Get project information
data "google_project" "project" {}

# Create a dedicated GCP service account for memgpt-server
resource "google_service_account" "memgpt_server_sa" {
  account_id   = "memgpt-server-${local.env}-sa"
  display_name = "MemGPT Server Service Account in ${local.env}"
  description  = "Service account for memgpt-server in ${local.env} environment"
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

  sa_email = google_service_account.memgpt_server_sa.email
  sa_name  = google_service_account.memgpt_server_sa.name

  # Set of secrets this service needs access to
  # TODO: automatically generate this list from the outputs of the secrets module or something
  # TODO: Also, trigger the apply of service config when there's a new server
  secret_names = [
    for secret in data.terraform_remote_state.secrets.outputs.secrets_names :
    join("_", slice(split("_", secret), 2, length(split("_", secret)))) if length(split("_", secret)) >= 3 &&
    split("_", secret)[0] == local.env &&
    split("_", secret)[1] == local.service
  ]

  # Additional project IAM bindings for the service account
  project_bindings = [
    "roles/cloudprofiler.agent",
  ]
  # Additional service account IAM bindings for the service account
  sa_bindings = [
    # "roles/cloudprofiler.agent",
  ]
}
