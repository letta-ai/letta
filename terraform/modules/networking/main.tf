locals {
  # TODO: maybe refactor to pull region from vpc
  # resource and apply it to relevant resources
  env_region_suffix = "${var.env}-${var.region}"
  vpc_name = var.env == "prod" ? "letta-vpc" : "letta-${local.env_region_suffix}-vpc"
  subnet_name = var.env == "prod" ? "letta-subnet" : "letta-${local.env_region_suffix}-subnet"
  private_ip_address = var.env == "prod" ? "private-ip-address" : "private-ip-address-letta-${local.env_region_suffix}"
  letta_web_static_ip = var.env == "prod" ? "letta-web-ip" : "letta-web-static-ip-${local.env_region_suffix}"
  # peering_network = var.env == "prod" ? "letta-vpc" : "letta-vpc-${local.env_region_suffix}"
}

# Networking for GKE cluster
resource "google_compute_network" "vpc_network" {
  name                    = local.vpc_name
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = local.subnet_name
  ip_cidr_range = var.vpc_subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc_network.name

  private_ip_google_access = true
}

resource "google_compute_global_address" "private_ip_address" {
  name          = local.private_ip_address
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc_network.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = local.vpc_name
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

resource "google_compute_global_address" "letta_web_static_ip" {
  name        = local.letta_web_static_ip
  description = var.env == "prod" ? "" : "Static IP for letta-web service"
}
