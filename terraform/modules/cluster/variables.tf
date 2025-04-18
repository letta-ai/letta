variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "memgpt-428419"
}
variable "env" {
  description = "Environment in which to deploy"
  type        = string
  default     = "dev"
}

variable "region" {
  description = "GCP Region"
  default     = "us-central1"
}

variable "cluster_prefix" {
  description = "GKE Cluster prefix"
  default     = "letta"
}

# GKE Cluster Config
variable "initial_node_count" {
  description = "Initial number of nodes for cluster"
  type = number
  default = 1
}

variable "vpc_network_name" {
  description = "Name of VPC network to host the cluster"
  type = string
}

variable "subnet_name" {
  description = "Name of subnet for nodes in cluster"
  type = string
}

variable "private_cluster_ipv4_block" {
  description = "CIDR-formatted IPv4 block for intra-cluster networking"
  type = string
}


# GKE Node Pool Config
variable "node_pool_name" {
  description = "Name of node pool"
  type = string
  default = "default-pool"
}

variable "node_pool_autoscaling_min" {
  description = "Minimum number of nodes to have available in the cluster"
  type = number
  default = 1
}
variable "node_pool_autoscaling_max" {
  description = "Maximum number of nodes to have available in the cluster"
  type = number
  default = 1
}

variable "machine_type" {
  description = "Type of instance to launch"
  type = string
}

variable "disk_size_gb" {
  description = "Size of disk (in GB) given to each node in the cluster"
  type = number
}
