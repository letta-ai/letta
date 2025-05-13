locals {
    env_region_suffix = "${var.env}-${var.region}"
    # if env == prod use existing names for everything
    cluster_name = var.env == "prod" ? "letta" : "${var.cluster_prefix}-${local.env_region_suffix}"
}

resource "google_container_cluster" "primary" {
  name     = local.cluster_name
  location = var.region

  initial_node_count       = var.initial_node_count

  network    = var.vpc_network_name
  subnetwork = var.subnet_name

  # Enable private cluster with public endpoint
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = var.private_cluster_ipv4_block
  }

  # trying to make prod importable
  remove_default_node_pool = var.env == "prod" ? false : true
  timeouts {}

  # Enable Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Enable VPC-native cluster
  ip_allocation_policy {}
}

resource "google_container_node_pool" "default_pool" {
  name       = var.node_pool_name
  location   = var.region
  cluster    = google_container_cluster.primary.name

  autoscaling {
    total_min_node_count = var.node_pool_autoscaling_min
    total_max_node_count = var.node_pool_autoscaling_max
    location_policy      = "ANY"
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type = var.machine_type
    disk_size_gb = var.disk_size_gb
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    resource_labels = {
      goog-gke-node-pool-provisioning-model = "on-demand"
    }
    metadata = {
      disable-legacy-endpoints = "true"
    }
    kubelet_config {
      cpu_manager_policy = ""
      cpu_cfs_quota  = false
      pod_pids_limit = 0
    }
    # Enable Workload Identity on nodes
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }
}
