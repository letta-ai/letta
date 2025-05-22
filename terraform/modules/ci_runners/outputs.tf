# Output the webhook URL
output "webhook_url" {
  value = google_cloudfunctions_function.github_webhook.https_trigger_url
}

# Output the instance group
output "instance_group" {
  value = google_compute_instance_group_manager.ci-runners.self_link
}

# Output the service account email
output "service_account_email" {
  value = google_service_account.ci-runner.email
}
