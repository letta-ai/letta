terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/dev/letta-web"
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

# Get project information
data "google_project" "project" {}

# Define local variables
locals {
  env     = "dev"
  service = "letta-web"
  region  = "us-central1"
}

# Create a dedicated GCP service account for letta-web
resource "google_service_account" "letta_web_sa" {
  account_id   = "${local.service}-${local.env}-sa"
  display_name = "${title(replace(local.service, "-", " "))} Service Account in ${local.env}"
  description  = "Service account for ${local.service} in ${local.env} environment"
}

# Get output from secrets module
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

  env        = local.env
  region     = local.region
  service    = local.service
  project_id = data.google_project.project.project_id
  sa_email   = google_service_account.letta_web_sa.email
  sa_name    = google_service_account.letta_web_sa.name

  # Dynamic secret names based on terraform_remote_state output
  secret_names = [
    for secret in data.terraform_remote_state.secrets.outputs.secrets_names :
    join("_", slice(split("_", secret), 2, length(split("_", secret)))) if length(split("_", secret)) >= 3 &&
    split("_", secret)[0] == local.env &&
    split("_", secret)[1] == local.service
  ]
}
