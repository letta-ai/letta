variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "memgpt-428419"
}

variable "region" {
  description = "GCP Region"
  default     = "us-central1"
}

variable "env" {
  description = "Environment in which to deploy"
  type        = string
  default     = "prod"
}
