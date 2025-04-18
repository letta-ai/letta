variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "memgpt-428419"
}

variable "region" {
  description = "GCP Region"
  default     = "us-central1"
}

variable "cluster_name" {
  description = "GKE Cluster Name"
  default     = "letta"
}

variable "registry_name" {
  description = "Name of the Artifact Registry repository"
  type        = string
  default     = "letta"
}

variable "db_password" {
  description = "Password for the database"
  type        = string
}
