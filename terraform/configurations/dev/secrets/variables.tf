variable "dev_ci_gh_app_id" {
  description = "GitHub App ID for CI integration"
  type        = string
  sensitive   = true
}
variable "dev_ci_gh_app_private_key" {
  description = "GitHub App private key for CI integration"
  type    = string
  sensitive = true
}
variable "dev_ci_webhook_secret" {
  description = "Webhook secret for CI integration (needs upload to Github app)"
  type        = string
  sensitive   = true
}
