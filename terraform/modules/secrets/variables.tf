variable "env" {
  description = "Environment in which to deploy"
  type        = string
}

variable "region" {
  description = "Region in which to deploy"
  type        = string
}

variable "secrets" {
  description = "Map of secret names (in format 'env_service_secretname') to their values (sourced from 1Password)"
  type        = map(string)
  sensitive   = true
  validation {
    condition     = alltrue([for secret_name in keys(var.secrets) : can(regex("^.*_.*_.*$", secret_name))])
    error_message = "Secret name must be in format 'env_service_secretname'"
  }
}

variable "secret_names" {
  description = "List of secret names (in format 'env_service_secretname')"
  type        = set(string)
  validation {
    condition     = alltrue([for secret_name in var.secret_names : can(regex("^.*_.*_.*$", secret_name))])
    error_message = "Secret name must be in format 'env_service_secretname'"
  }
}

variable "create_only_secrets" {
  description = "List of secret names to create but leave the value empty"
  type        = set(string)
  validation {
    condition     = alltrue([for secret_name in var.create_only_secrets : can(regex("^.*_.*_.*$", secret_name))])
    error_message = "Secret name must be in format 'env_service_secretname'"
  }
}
