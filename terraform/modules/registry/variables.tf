variable "env" {
  description = "Environment in which to deploy"
  type        = string
  default     = "dev"
}
variable "region" {
  description = "GCP Region"
  default     = "us-central1"
}
variable "registry_prefix" {
  description = "Base name for registry"
  default     = "letta"
}
