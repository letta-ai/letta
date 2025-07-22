variable "project_id" {
  description = "The GCP project ID"
  type        = string
  default     = "memgpt-428419"
}

variable "env" {
  description = "Environment"
  type        = string
  default     = "dev"
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "The GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "machine_type" {
  description = "The machine type for GPU runners"
  type        = string
  default     = "g2-standard-4"
}

variable "image_family" {
  description = "The image family for GPU runners"
  type        = string
  default     = "gpu-runner-dev"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 100
}

variable "disk_type" {
  description = "Boot disk type"
  type        = string
  default     = "hyperdisk-balanced"
}

variable "gpu_type" {
  description = "GPU accelerator type"
  type        = string
  default     = "nvidia-l4"
}

variable "gpu_count" {
  description = "Number of GPUs per instance"
  type        = number
  default     = 1
}

variable "target_size" {
  description = "Target number of instances"
  type        = number
  default     = 1
}

variable "github_org" {
  description = "GitHub organization"
  type        = string
  default     = "letta-ai"
}

variable "runner_labels" {
  description = "Labels for the GitHub runner"
  type        = string
  default     = "gcp"
}

variable "ssh_pubkey" {
  description = "SSH public key for instance access"
  type        = string
  default     = "letta:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDHj8G8QK7QfV8VzF6Y5H8J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J2K8W9Q0G8Q7J letta@local"
}
