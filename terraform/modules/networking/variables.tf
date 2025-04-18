variable "env" {
    description = "Environment in which to deploy"
    type = string
}
variable "region" {
  description = "GCP Region"
  default     = "us-central1"
}
variable "vpc_subnet_cidr" {
    description = "Subnet CIDR for VPC"
    type = string
}
