variable "env" {
  description = "Environment in which to deploy"
  type = string
  default = "dev"
}

variable "region" {
  description = "Region in which to deploy"
  type = string
  default = "us-central1"
}
variable "db_password" {
  description = "Password for the database"
  type        = string
}
