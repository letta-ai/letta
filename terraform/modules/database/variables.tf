
variable "env" {
  description = "Environment in which to deploy"
  type = string
}

variable "region" {
  description = "Region in which to deploy"
  type = string
}

variable "db_prefix" {
  description = "Prefix for database name"
  type = string
  default = "letta"
}

variable "db_tier" {
  description = "Tier of DB instance to create"
  type = string
}
variable "vpc_network_id" {
  description = "ID of VPC network"
  type = string
}

# TODO: source this from secrets manager
variable "db_user" {
  description = "Username for the database"
  type        = string
}
# TODO: source this from secrets manager
variable "db_password" {
  description = "Password for the database"
  type        = string
}

variable "redis_memory_size_gb" {
  type = number
  description = "Size of memory (in GB) of redis instance"
}
