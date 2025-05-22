variable "env" {
  description = "Environment in which to deploy"
  type        = string
  default     = "dev"
}
# Variables file
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP Zone"
  type        = string
  default     = "us-central1-a"
}

variable "machine_type" {
  description = "Machine type for runner instances"
  type        = string
  default     = "c4a-standard-2"
}

variable "disk_size_gb" {
  description = "Size of disk for runner in GB"
  type        = number
  default     = 100
}

variable "disk_type" {
  description = "Type of disk for runner (must be compatible with machine-tpye)"
  type        = string
  default     = "hyperdisk-balanced"
}

variable "ssh_pubkey" {
  description = "Public key to add to GCP metadata (e.g. letta:ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILflk18SwzkU5NS9CPylt3vszYJas365wX7OCTbxPWXw)"
  type        = string
}

variable "runner_image" {
  description = "Packer-built image for GitHub runners"
  type        = string
}

variable "github_org" {
  description = "GitHub organization name"
  type        = string
  default = "letta-ai"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default = "letta-cloud"
}

variable "min_runners" {
  description = "Minimum number of runners"
  type        = number
  default     = 1
}

variable "max_runners" {
  description = "Maximum number of runners"
  type        = number
  default     = 2
}

variable "runner_labels" {
  description = "Additional labels for the runner"
  type        = string
  default     = ""
}
