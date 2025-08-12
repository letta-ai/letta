# Create a service account for the jump box
resource "google_service_account" "jump_box" {
  account_id   = "jump-box-sa-${var.env}"
  display_name = "Jump Box Service Account"
}

# Grant necessary permissions to the service account
resource "google_project_iam_member" "jump_box_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.jump_box.email}"
}

resource "google_project_iam_member" "jump_box_metrics" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.jump_box.email}"
}

# Reference the VPC subnet
data "google_compute_subnetwork" "subnetwork" {
  name   = var.env == "prod" && var.region == "us-central1" ? "letta-subnet" : "letta-${var.env}-${var.region}-subnet"
  region = var.region
}

# SSH key will be added at instance level only

# Create firewall rule for SSH access to jump box
resource "google_compute_firewall" "jump_box_ssh" {
  name    = "jump-box-ssh-${var.env}"
  network = data.google_compute_subnetwork.subnetwork.network

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.allowed_ssh_sources
  target_tags   = ["jump-box-${var.env}"]
}

# Create the jump box instance
resource "google_compute_instance" "jump_box" {
  name         = "jump-box-${var.env}"
  machine_type = var.machine_type
  zone         = var.zone

  tags = ["jump-box-${var.env}"]

  boot_disk {
    initialize_params {
      image = var.image
      size  = var.disk_size
      type  = "pd-standard"
    }
  }

  network_interface {
    subnetwork = data.google_compute_subnetwork.subnetwork.self_link

    access_config {
      # Ephemeral public IP
    }
  }

  metadata = {
    ssh-keys = "${var.ssh_username}:${var.ssh_public_key}"
  }

  service_account {
    email  = google_service_account.jump_box.email
    scopes = ["cloud-platform"]
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    apt-get update
    apt-get install -y htop vim curl wget

    # Create user if it doesn't exist
    if ! id "${var.ssh_username}" &>/dev/null; then
      useradd -m -s /bin/bash ${var.ssh_username}
      usermod -aG sudo ${var.ssh_username}
    fi
  EOF

  lifecycle {
    create_before_destroy = true
  }
}
