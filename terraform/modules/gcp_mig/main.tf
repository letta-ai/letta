data "google_compute_subnetwork" "subnetwork" {
  name = "letta-${var.env}-${var.region}-subnet" # TODO: template this
  region = var.region
}

# Create a template for the runner instances
resource "google_compute_instance_template" "pool_template" {
  name_prefix  = "${var.pool_name_prefix}-${var.env}-template-"
  machine_type = var.machine_type
  tags         = ["${var.pool_name_prefix}-${var.env}"]

  disk {
    source_image = var.runner_image  # Packer-built image
    auto_delete  = true
    boot         = true
    disk_size_gb = var.disk_size_gb
    disk_type    = var.disk_type
  }

  network_interface {
    network    = data.google_compute_subnetwork.subnetwork.network
    subnetwork = data.google_compute_subnetwork.subnetwork.id
    access_config {
      # Ephemeral public IP
    }
  }

  service_account {
    email  = var.sa_email # TODO: don't hardcode this
    scopes = ["cloud-platform"]
  }

  scheduling {
    provisioning_model = "SPOT"
    instance_termination_action = "STOP"
    preemptible = true
    automatic_restart  = false
    on_host_maintenance = "TERMINATE"
  }

  metadata = {
    ssh-keys = var.ssh_pubkey
    startup-script = templatefile(
      "${path.module}/files/startup.sh.tftpl",
      {
        env           = var.env,
        github_org    = var.github_org
        runner_labels = var.runner_labels
        # pre registration with github
        final_steps = var.final_steps
      }
    )
    shutdown-script = templatefile(
      "${path.module}/files/shutdown.sh.tftpl",
      {
        env = var.env
      }
    )
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Create an instance group manager
resource "google_compute_instance_group_manager" "pool-manager" {
  name = "${var.pool_name_prefix}-manager-${var.env}"
  zone = var.zone

  base_instance_name = "${var.pool_name_prefix}-${var.env}"

  version {
    instance_template = google_compute_instance_template.pool_template.id
  }

  target_size = var.min_runners

  named_port {
    name = "http"
    port = 80
  }
}
