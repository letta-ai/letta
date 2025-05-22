# Output the webhook URL
output "webhook_url" {
  value = module.ci_runners.webhook_url
}

# Output the instance group
output "instance_group" {
  value = module.ci_runners.instance_group
}

# Output the service account email
output "service_account_email" {
  value = module.ci_runners.service_account_email
}
