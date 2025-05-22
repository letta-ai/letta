terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/prod/database"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
    }
  }
}

provider "google" {
  project = "memgpt-428419"
  region  = var.region
}

# Add data sources to reference existing resources instantiated in networking
data "google_compute_network" "vpc_network" {
  name = "letta-vpc"
}

module database {
    source = "../../../modules/database"

    env = var.env
    region = var.region

    db_tier = "db-perf-optimized-N-8"
    vpc_network_id = data.google_compute_network.vpc_network.id

    connection_pool_flags = {
      client_connection_idle_timeout = (25 * 60) # 25 minutes
    }

    database_flags = {
      idle_in_transaction_session_timeout = (25 * 60 * 1000) # 25 minutes
    }

    db_user = "staff"
    db_password = var.db_password

    redis_memory_size_gb = 4
}
