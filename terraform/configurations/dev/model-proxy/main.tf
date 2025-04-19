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

module model-proxy {
    source = "../../../modules/model-proxy"
    # project number NOT project ID
    project_number = data.google_project.project.number
    subscription_name = "gcs-subscription"
    topic_name = "model-proxy"
}
