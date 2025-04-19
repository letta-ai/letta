
resource "google_storage_bucket" "bucket" {
  name     = "model-proxy-subscription-${var.env}"
  location = var.region
  uniform_bucket_level_access = true
}

# Create topic
resource "google_pubsub_topic" "topic" {
  name = "${var.topic_name}-${var.env}"
}

# Grant Storage Object Creator and Legacy Bucket Reader roles
resource "google_storage_bucket_iam_member" "pubsub_service_account_object_creator" {
  bucket = google_storage_bucket.bucket.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:service-${var.project_number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}
resource "google_storage_bucket_iam_member" "pubsub_service_account_legacy_bucket_reader" {
  bucket = google_storage_bucket.bucket.name
  role   = "roles/storage.legacyBucketReader"
  member = "serviceAccount:service-${var.project_number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# Create Pub/Sub subscription with GCS as the push endpoint
resource "google_pubsub_subscription" "gcs_subscription" {

  depends_on = [
    google_storage_bucket_iam_member.pubsub_service_account_legacy_bucket_reader,
    google_storage_bucket_iam_member.pubsub_service_account_object_creator,
  ]

  name  = "${var.subscription_name}-${var.env}"
  topic = google_pubsub_topic.topic.id

  # Configure Cloud Storage as the destination
  cloud_storage_config {
    bucket = google_storage_bucket.bucket.name
    # Optional: Configure a specific format for the GCS object
    # filename_prefix = "pubsub-message-"
    # filename_suffix = ".json"
    # Optional: Configure a specific format for message batching
    # max_duration = "60s"
    # max_bytes = 1000000
    # service_account_email = google_service_account.pubsub_to_gcs_sa.email
  }

#   # Set the service account that Pub/Sub will use to write to GCS
#   push_config {
#     push_endpoint = google_storage_bucket.bucket.url
#     oidc_token {
#       service_account_email =
#     }
#   }

  # Optional: Configure message retention
  # message_retention_duration = "604800s" # 7 days
  # retain_acked_messages = true

  # Optional: Configure dead-letter policy
  # dead_letter_policy {
  #   dead_letter_topic     = google_pubsub_topic.dead_letter.id
  #   max_delivery_attempts = 5
  # }
}

# Optional: Create a Pub/Sub dead-letter topic for failed messages
# resource "google_pubsub_topic" "dead_letter" {
#   name = "${var.topic_name}-dead-letter"
# }
