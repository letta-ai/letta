variable "env" {
    description = "Environment in which to deploy"
    default = "dev"
    type = string
}

variable "region" {
    description = "Region in which to deploy"
    default = "us-central1"
    type = string
}
