terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/prod/cluster"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

data "google_compute_network" "vpc_network" {
  name = "letta-vpc"
}

data "google_compute_subnetwork" "subnet" {
  name   = "letta-subnet"
  region = var.region
}

module cluster {
  source = "../../../modules/cluster"

  project_id = var.project_id
  env = var.env
  region = var.region

  cluster_prefix = "letta"

  # GKE Cluster Config
  initial_node_count = 1
  vpc_network_name = data.google_compute_network.vpc_network.name
  subnet_name = data.google_compute_subnetwork.subnet.name
  private_cluster_ipv4_block = "172.16.0.0/28"

  # GKE Node Pool Config
  node_pool_autoscaling_min = 1
  node_pool_autoscaling_max = 16
  machine_type = "e2-standard-4"
  disk_size_gb = 100
}
