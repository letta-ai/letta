terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/dev/probes"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.30"
    }
  }
}

locals {
  env = "dev"
  region = "us-central1"
  service = "probes"
}

provider "google" {
  project = "memgpt-428419"
  region  = local.region
}


data "google_secret_manager_secret" "clickhouse_password" {
    secret_id = "dev_memgpt-server_CLICKHOUSE_PASSWORD"
}

data "google_secret_manager_secret" "slack_webhook_url" {
    secret_id = "customer-alerting-bot-webhook"
}

resource "google_service_account" "probe_function" {
  account_id   = "probe-${var.env}-sa"
  display_name = "Probe Function SA"
}

resource "google_secret_manager_secret_iam_member" "clickhouse_password_access" {
  secret_id = data.google_secret_manager_secret.clickhouse_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.probe_function.email}"
}

resource "google_secret_manager_secret_iam_member" "slack_webhook_access" {
  secret_id = data.google_secret_manager_secret.slack_webhook_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.probe_function.email}"
}

resource "google_storage_bucket" "function_source" {
  name     = "probe-${var.env}-source"
  location = var.region

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }
}

data "archive_file" "function_source" {
  type        = "zip"
  source_dir  = "${path.module}/function"
  output_path = "${path.module}/function.zip"
}

resource "google_storage_bucket_object" "function_source" {
  name   = "function-${data.archive_file.function_source.output_md5}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.function_source.output_path
}

resource "google_cloudfunctions2_function" "probe" {
  name     = "probe"
  location = var.region

  build_config {
    runtime     = "python311"
    entry_point = "check_alerts"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.function_source.name
      }
    }
  }

  service_config {
    max_instance_count    = 10
    min_instance_count    = 0
    available_memory      = "256M"
    timeout_seconds       = 60
    service_account_email = google_service_account.probe_function.email

    environment_variables = {
      CLICKHOUSE_HOST = var.clickhouse_host
      CLICKHOUSE_USER = var.clickhouse_user
      PROJECT_ID      = var.project_id
      LETTA_PROJECT_ID = "dffe5d60-3faa-421a-acf5-0755a1fb0f80"
      LETTA_ORGANIZATION_ID = "8075b11a-6882-4c0e-9774-9ad199a7214b"
    }
  }
}

resource "google_cloud_run_service_iam_member" "scheduler_invoker" {
  location = google_cloudfunctions2_function.probe.location
  service  = google_cloudfunctions2_function.probe.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}

resource "google_service_account" "scheduler" {
  account_id   = "probe-scheduler-${var.env}-sa"
  display_name = "Probe Scheduler SA"
}

resource "google_cloud_scheduler_job" "probe_schedule" {
  name             = "probe-schedule-${var.env}"
  description      = "Trigger ClickHouse probe every 5 minutes"
  schedule         = "*/2 * * * *"  # Every 5 minutes
  time_zone        = "UTC"
  attempt_deadline = "120s"

  retry_config {
    retry_count = 1
  }

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions2_function.probe.service_config[0].uri

    oidc_token {
      audience              = "${google_cloudfunctions2_function.probe.service_config[0].uri}/"
      service_account_email = google_service_account.scheduler.email
    }
  }
}
