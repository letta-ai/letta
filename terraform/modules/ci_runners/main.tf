# Create a service account for the runner instances
resource "google_service_account" "ci-runner" {
  account_id   = "ci-runner-sa-${var.env}"
  display_name = "GitHub Runner Service Account"
}

# Grant necessary permissions to the service account
resource "google_project_iam_member" "runner_permissions" {
  project = var.project_id
  role    = "roles/compute.instanceAdmin.v1"
  member  = "serviceAccount:${google_service_account.ci-runner.email}"
}

# Add additional roles for the service account
resource "google_project_iam_member" "runner_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.ci-runner.email}"
}

resource "google_project_iam_member" "runner_metrics" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.ci-runner.email}"
}
data "google_secret_manager_secret_version" "github_app_key" {
    secret = "${var.env}_ci_gh-app-private-key"
}
data "google_secret_manager_secret_version" "github_app_id" {
    secret = "${var.env}_ci_gh-app-id"
}
data "google_secret_manager_secret_version" "github_app_webhook_secret" {
    secret = "${var.env}_ci_webhook-secret"
}

# Grant permission to access specific CI secrets
resource "google_project_iam_member" "runner_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.ci-runner.email}"

  # I would love to have this condition enforced but it REFUSES to work 🙄
  # condition {
  #   title       = "Allow access to CI secrets by prefix"
  #   expression  = "resource.type == 'secretmanager.googleapis.com/Secret' && resource.name.startsWith('projects/${var.project_id}/secrets/${var.env}_ci_')"
  # }
}

resource "google_project_iam_member" "runner_secret_lister" {
  project = var.project_id
  role    = "roles/secretmanager.viewer"
  member  = "serviceAccount:${google_service_account.ci-runner.email}"
}

data "google_compute_subnetwork" "subnetwork" {
  name = "letta-${var.env}-${var.region}-subnet"
  region = var.region
}

# Create firewall rule for SSH
resource "google_compute_firewall" "ci-runner_ssh" {
  name    = "ci-runner-ssh-${var.env}"
  network = data.google_compute_subnetwork.subnetwork.network

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"] # Consider restricting to your IP or VPN
  target_tags   = ["ci-runner-${var.env}"]
}

# Create firewall rule for egress traffic (runners need to talk to GitHub)
resource "google_compute_firewall" "ci-runner_egress" {
  name    = "ci-runner-${var.env}-egress"
  network = data.google_compute_subnetwork.subnetwork.network

  allow {
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  allow {
    protocol = "icmp"
  }

  direction     = "EGRESS"
  target_tags   = ["ci-runner-${var.env}"]
  destination_ranges = ["0.0.0.0/0"]
}

# # Create a Cloud Function to handle GitHub webhooks and scaling
# resource "google_storage_bucket" "function_bucket" {
#   name     = "letta-ci-runner-${var.env}-functions"
#   location = var.region
#   uniform_bucket_level_access = true
# }

# # Zip the function code
# data "archive_file" "function_zip" {
#   type        = "zip"
#   output_path = "${path.module}/files/function.zip"

#   source {
#     content  = file("${path.module}/files/cloud_function.py")
#     filename = "main.py"
#   }

#   source {
#     content  = file("${path.module}/files/requirements.txt")
#     filename = "requirements.txt"
#   }
# }

# # Upload the zipped function code
# resource "google_storage_bucket_object" "function_code" {
#   name   = "function-${data.archive_file.function_zip.output_md5}.zip"
#   bucket = google_storage_bucket.function_bucket.name
#   source = data.archive_file.function_zip.output_path
# }

# # Create the webhook handler function
# resource "google_cloudfunctions_function" "github_webhook" {
#   name        = "github-webhook-handler-${var.env}"
#   description = "Handles GitHub webhook events for scaling runners"
#   runtime     = "python310"

#   available_memory_mb   = 512
#   source_archive_bucket = google_storage_bucket.function_bucket.name
#   source_archive_object = google_storage_bucket_object.function_code.name
#   trigger_http          = true
#   entry_point           = "webhook_handler"

#   environment_variables = {
#     PROJECT_ID           = var.project_id
#     ZONE                 = var.zone
#     INSTANCE_GROUP       = google_compute_instance_group_manager.ci-runners.name
#     MIN_RUNNERS          = var.min_runners
#     MAX_RUNNERS          = var.max_runners
#     GITHUB_ORG           = var.github_org
#     GITHUB_REPO          = var.github_repo
#     WEBHOOK_SECRET       = data.google_secret_manager_secret_version.github_app_webhook_secret.secret_data
#   }

#   service_account_email = google_service_account.ci-runner.email
# }

# # Create IAM policy to allow public access to the webhook function
# resource "google_cloudfunctions_function_iam_member" "webhook_invoker" {
#   project        = var.project_id
#   region         = var.region
#   cloud_function = google_cloudfunctions_function.github_webhook.name
#   role           = "roles/cloudfunctions.invoker"
#   member         = "allUsers"
# }
