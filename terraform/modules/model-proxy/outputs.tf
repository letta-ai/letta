output "pubsub_topic_name" {
  value = google_pubsub_topic.topic.name
}

output "gcs_bucket_name" {
  value = google_storage_bucket.bucket.name
}

output "gcs_bucket_url" {
  value = google_storage_bucket.bucket.url
}

output "subscription_name" {
  value = google_pubsub_subscription.gcs_subscription.name
}
