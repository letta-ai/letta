variable "project_number" {
  description = "GCP Project ID"
  type        = string
}

variable "env" {
  description = "Environment in which to deploy"
  type        = string
  default     = "dev"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "topic_name" {
  description = "Pub/Sub topic name"
  type        = string
  default     = "model-proxy"
}

variable "subscription_name" {
  description = "Pub/Sub subscription name"
  type        = string
  default     = "gcs-subscription"
}
