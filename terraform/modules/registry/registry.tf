locals {
    env_region_suffix = "${var.env}-${var.region}"
    respository_id = var.env == "prod" ? "letta" : "${var.registry_prefix}-${local.env_region_suffix}"
}
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = local.respository_id
  description   = "Docker repository in ${local.env_region_suffix}"
  format        = "DOCKER"
}
