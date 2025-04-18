terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/dev/cluster"
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

# Add data sources to reference existing resources instantiated in networking
data "google_compute_network" "vpc_network" {
  name = "letta-${var.env}-${var.region}-vpc"
}

data "google_compute_subnetwork" "subnet" {
  name   = "letta-${var.env}-${var.region}-subnet"
  region = var.region
}

module cluster {
  source = "../../../modules/cluster"

  project_id = "memgpt-428419"
  env = var.env
  region = var.region

  cluster_prefix = "letta"

  # GKE Cluster Config
  initial_node_count = 1
  vpc_network_name = data.google_compute_network.vpc_network.name
  subnet_name = data.google_compute_subnetwork.subnet.name
  private_cluster_ipv4_block = "172.16.2.0/28"

  # GKE Node Pool Config
  node_pool_autoscaling_min = 1
  node_pool_autoscaling_max = 2
  machine_type = "e2-standard-4"
  disk_size_gb = 100
}
