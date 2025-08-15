locals {
  # TODO: maybe refactor to pull region from vpc
  # resource and apply it to relevant resources
  env_region_suffix = "${var.env}-${var.region}"
  vpc_name = var.env == "prod" && var.region == "us-central1" ? "letta-vpc" : "letta-${local.env_region_suffix}-vpc"
  subnet_name = var.env == "prod" && var.region == "us-central1" ? "letta-subnet" : "letta-${local.env_region_suffix}-subnet"
  private_ip_address = var.env == "prod" && var.region == "us-central1" ? "private-ip-address" : "private-ip-address-letta-${local.env_region_suffix}"
  letta_web_static_ip = var.env == "prod" && var.region == "us-central1" ? "letta-web-ip" : "letta-web-static-ip-${local.env_region_suffix}"
  # peering_network = var.env == "prod" && var.region == "us-central1" ? "letta-vpc" : "letta-vpc-${local.env_region_suffix}"
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
  description = var.env == "prod" && var.region == "us-central1" ? "" : "Static IP for letta-web service"
}

# Cloud Router for NAT gateway
resource "google_compute_router" "router" {
  name    = var.env == "prod" && var.region == "us-central1" ? "letta-router" : "letta-${local.env_region_suffix}-router"
  region  = var.region
  network = google_compute_network.vpc_network.id
}

# Cloud NAT gateway for outbound internet access from private nodes
resource "google_compute_router_nat" "nat" {
  name                               = var.env == "prod" && var.region == "us-central1" ? "letta-gateway" : "letta-${local.env_region_suffix}-gateway"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}
