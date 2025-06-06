terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/dev/model-proxy"
  }
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.30"
    }
  }
}

provider "google" {
  project = "memgpt-428419"
  region  = "us-central1"
}

data "google_project" "project" {}

# REDO: Consider moving this to a separate module
# Create a dedicated GCP service account for model-proxy
resource "google_service_account" "model_proxy_sa" {
  account_id   = "model-proxy-${var.env}-sa"
  display_name = "Model Proxy Service Account in ${var.env}"
  description  = "Service account for model-proxy in ${var.env} environment"
}

# get output from secrets module
data "terraform_remote_state" "secrets" {
  backend = "remote"

  config = {
    organization = "hashicorp"
    workspaces = {
      name = "infra/tfstate/dev/secrets"
    }
  }
}

module model-proxy {
  source = "../../../modules/model-proxy"
  # project number NOT project ID
  model_proxy_sa_email = google_service_account.model_proxy_sa.email
  project_number = data.google_project.project.number
  subscription_name = "gcs-subscription"
  topic_name = "model-proxy"
}

# this should create the secrets in the cluster for the service
module k8s-iam {
  source = "../../../modules/k8s-iam"

  sa_email = google_service_account.model_proxy_sa.email
  sa_name = google_service_account.model_proxy_sa.name
  env = var.env
  region = var.region
  service = "model-proxy"
  project_id = data.google_project.project.project_id
  secret_names = [
    for secret in data.terraform_remote_state.secrets.outputs.secrets_names :
    join("_", slice(split("_", secret), 2, length(split("_", secret)))) if length(split("_", secret)) >= 3 &&
    split("_", secret)[0] == var.env &&
    split("_", secret)[1] == var.service
  ]
}
