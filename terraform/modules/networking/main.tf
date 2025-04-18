locals {
  # TODO: maybe refactor to pull region from vpc
  # resource and apply it to relevant resources
  env_region_suffix = "${var.env}-${var.region}"
  cluster_name = "letta-${local.env_region_suffix}"
}

# Networking for GKE cluster
resource "google_compute_network" "vpc_network" {
  name                    = "${local.cluster_name}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "${local.cluster_name}-subnet"
  ip_cidr_range = var.vpc_subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc_network.name

  private_ip_google_access = true
}

resource "google_compute_global_address" "private_ip_address" {
  name          = "private-ip-address-${local.cluster_name}"
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

resource "google_compute_global_address" "letta_web_static_ip" {
  name        = "letta-web-static-ip-${local.env_region_suffix}"
  description = "Static IP for letta-web service"
}
