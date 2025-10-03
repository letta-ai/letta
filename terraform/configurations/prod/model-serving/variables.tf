variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "memgpt-428419"
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

variable "env" {
  description = "environment"
  type        = string
  default     = "prod"
}
