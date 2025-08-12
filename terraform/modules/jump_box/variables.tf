variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "env" {
  description = "Environment (dev/prod)"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
}

variable "zone" {
  description = "The GCP zone for the instance"
  type        = string
}

variable "machine_type" {
  description = "The machine type for the jump box"
  type        = string
  default     = "e2-micro"
}

variable "image" {
  description = "The OS image for the jump box"
  type        = string
  default     = "ubuntu-os-cloud/ubuntu-2204-lts"
}

variable "disk_size" {
  description = "Boot disk size in GB"
  type        = number
  default     = 20
}

variable "ssh_username" {
  description = "Username for SSH access"
  type        = string
  default     = "jumpbox"
}

variable "allowed_ssh_sources" {
  description = "List of CIDR blocks allowed to SSH to the jump box"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_public_key" {
  description = "SSH public key for accessing the jump box"
  type        = string
}
