terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/dev/database"
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
  region  = var.region
}

# Add data sources to reference existing resources instantiated in networking
data "google_compute_network" "vpc_network" {
  name = "letta-${var.env}-${var.region}-vpc"
}

module database {
    source = "../../../modules/database"

    env = var.env
    region = var.region

    db_tier = "db-custom-8-32768"
    vpc_network_id = data.google_compute_network.vpc_network.id

    db_user = "staff"
    db_password = var.db_password

    redis_memory_size_gb = 4
}
