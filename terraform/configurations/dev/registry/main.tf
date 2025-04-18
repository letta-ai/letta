terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/dev/registry"
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



module registry {
  source = "../../../modules/registry"

  region = "us-central1"
  env = "dev"
  registry_prefix = "letta"
}
