# variables.tf
variable "project_id" {
  description = "GCP Project ID"
  type = string
  default = "memgpt-428419"
}

variable "region" {
  type = string
  default = "us-central1"
}

variable "env" {
  type = string
  default = "dev"
}

variable "clickhouse_host" {
  description = "ClickHouse host"
  default = "https://apyhgglpro.us-central1.gcp.clickhouse.cloud"
}

variable "clickhouse_user" {
  description = "ClickHouse username"
  default = "default"
}
