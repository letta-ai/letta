# Allow the Kubernetes service account to impersonate the GCP service account
resource "google_service_account_iam_binding" "workload_identity_binding" {
  service_account_id = var.sa_name
  role               = "roles/iam.workloadIdentityUser"
  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[default/${var.service}]"
  ]
}

# allow secret service account to access all named secrets
resource "google_secret_manager_secret_iam_member" "secret_iam" {
  for_each = var.secret_names
  secret_id   = "${var.env}_${var.service}_${each.key}"
  role     = "roles/secretmanager.secretAccessor"
  member   = "serviceAccount:${var.sa_email}"
}

# allow additional permissions
resource "google_project_iam_member" "project_iam" {
  for_each = var.project_bindings
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${var.sa_email}"
}

resource "google_service_account_iam_binding" "sa_iam" {
  for_each  = var.sa_bindings
  service_account_id = var.sa_name
  role               = each.value
  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[default/${var.service}]"
  ]
}
