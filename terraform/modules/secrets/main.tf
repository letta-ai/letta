resource "google_secret_manager_secret" "secrets" {
  for_each = var.secret_names

  secret_id = each.key

  labels = {
    environment = split("_", each.key)[0]
    service     = split("_", each.key)[1]
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "secret_versions" {
  for_each = var.secret_names

  secret      = google_secret_manager_secret.secrets[each.key].id
  secret_data = var.secrets[each.key]
}
