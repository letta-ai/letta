packer {
  required_plugins {
    googlecompute = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/googlecompute"
    }
  }
}

variable "project_id" {
  type = string
}

variable "source_image_family" {
  type    = string
  default = "ubuntu-2404-lts-arm64"
}

variable "zone" {
  type    = string
  default = "us-central1-a"
}

variable "machine_type" {
  type    = string
  default = "c4a-standard-2"
}

variable "image_name" {
  type = string
}

variable "image_family" {
  type    = string
  default = ""
}

variable "image_description" {
  type    = string
  default = ""
}

variable "network" {
  type    = string
  default = "default"
}

variable "subnetwork" {
  type    = string
  default = ""
}

variable "tags" {
  type    = list(string)
  default = []
}

variable "scopes" {
  type = list(string)
  default = [
    "https://www.googleapis.com/auth/cloud-platform"
  ]
}

source "googlecompute" "base" {
  project_id          = var.project_id
  source_image_family = var.source_image_family
  zone                = var.zone
  machine_type        = var.machine_type
  image_name          = var.image_name
  image_family        = var.image_family
  image_description   = var.image_description
  network             = var.network
  subnetwork          = var.subnetwork
  tags                = var.tags
  scopes              = var.scopes
  ssh_username        = "letta"
}
