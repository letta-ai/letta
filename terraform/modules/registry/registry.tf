locals {
    env_region_suffix = "${var.env}-${var.region}"
}
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "${var.registry_prefix}-${local.env_region_suffix}"
  description   = "Docker repository in ${local.env_region_suffix}"
  format        = "DOCKER"
}
