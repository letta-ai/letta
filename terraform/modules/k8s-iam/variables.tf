variable "env" {
  type = string
}

variable "region" {
  type = string
}

variable "secret_names" {
  type = set(string)
}

variable "project_id" {
  type = string
  default = "memgpt-428419"
}

variable "service" {
  type = string
}

variable "sa_email" {
  type = string
}
variable "sa_name" {
  type = string
}

variable "project_bindings" {
  type = set(string)
  default = []
}
variable "sa_bindings" {
  type = set(string)
  default = []
}
