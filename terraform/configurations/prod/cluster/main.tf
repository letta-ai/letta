terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/prod/cluster"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_container_cluster" "primary" {
  name     = var.cluster_name
  location = var.region

  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.vpc_network.name
  subnetwork = google_compute_subnetwork.subnet.name

  # Enable private cluster with public endpoint
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  # Enable Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Enable VPC-native cluster
  ip_allocation_policy {}
}

resource "google_container_node_pool" "default_pool" {
  name       = "default-pool"
  location   = var.region
  cluster    = google_container_cluster.primary.name
  # removing because as stated in the docs, "should not be used alongside autoscaling."
  # node_count = 1

  autoscaling {
    total_min_node_count = 1
    total_max_node_count = 16
    location_policy      = "ANY"
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type = "e2-standard-4"
    disk_size_gb = 100
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]

    metadata = {
      disable-legacy-endpoints = "true"
    }

    # Enable Workload Identity on nodes
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }
}

resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = var.registry_name
  description   = "Docker repository for ${var.project_id}"
  format        = "DOCKER"
}

resource "google_compute_network" "vpc_network" {
  name                    = "${var.cluster_name}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "${var.cluster_name}-subnet"
  ip_cidr_range = "10.0.0.0/16"
  region        = var.region
  network       = google_compute_network.vpc_network.name

  private_ip_google_access = true
}

resource "google_compute_global_address" "private_ip_address" {
  name          = "private-ip-address"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc_network.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

resource "google_sql_database_instance" "postgres" {
  name             = "${var.cluster_name}-db"
  database_version = "POSTGRES_15"
  region           = var.region

  depends_on = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier = "db-custom-2-4096"

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc_network.id
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "database" {
  name     = "letta"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "users" {
  name     = "staff"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

resource "google_redis_instance" "cache" {
  name           = "${var.cluster_name}-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = 4

  region = var.region

  authorized_network = google_compute_network.vpc_network.id

  redis_version = "REDIS_6_X"
  display_name  = "${var.cluster_name} Redis Cache"

  depends_on = [google_compute_network.vpc_network]
}

resource "google_compute_global_address" "letta_web_static_ip" {
  name        = "letta-web-static-ip"
  description = "Static IP for letta-web service"
}
