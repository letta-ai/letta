terraform {
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

module "gpu_runners" {
  source = "../../../modules/gpu_runners"

  project_id    = var.project_id
  env           = var.env
  region        = var.region
  zone          = var.zone
  machine_type  = var.machine_type
  image_family  = var.image_family
  disk_size_gb  = var.disk_size_gb
  disk_type     = var.disk_type
  gpu_type      = var.gpu_type
  gpu_count     = var.gpu_count
  target_size   = var.target_size
  github_org    = var.github_org
  runner_labels = var.runner_labels
  ssh_pubkey    = var.ssh_pubkey
}
