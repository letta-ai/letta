packer {
  required_plugins {
    googlecompute = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/googlecompute"
    }
  }
}

locals {
  timestamp = regex_replace(timestamp(), "[- TZ:]", "")
}

# Pass-through variables
variable "project_id" {
  type = string
  default = "memgpt-428419"
}

variable "zone" {
  type    = string
  default = "us-central1-a"
}

variable "machine_type" {
  type    = string
  default = "c4a-standard-2"
}

variable "disk_type" {
  type    = string
  default = "hyperdisk-balanced"
}

# variable "network" {
#   type    = string
#   default = "default"
# }

# variable "subnetwork" {
#   type    = string
#   default = ""
# }

variable "environment" {
  type    = string
  default = "dev"
}

# CI runner specific variables

variable "runner_user" {
  type    = string
  default = "ci-runner"
}

# Image naming convention
variable "image_prefix" {
  type    = string
  default = "ci-runner"
}

source "googlecompute" "ci_runner" {
  project_id          = var.project_id
  source_image_family = "ubuntu-2404-lts-arm64"
  zone                = var.zone
  machine_type        = var.machine_type
  disk_type           = var.disk_type
  # Image naming that will make it easy to filter in Terraform
  image_name          = "${var.image_prefix}-${var.environment}-${local.timestamp}"
  image_family        = "${var.image_prefix}-${var.environment}"
  image_description   = "CI Runner base image for ${var.environment} environment"

  # network             = var.network
  # subnetwork          = var.subnetwork
  ssh_username        = "letta"

}

build {
  sources = ["source.googlecompute.ci_runner"]

  # Run common setup scripts
  provisioner "shell" {
    execute_command = "{{.Vars}} bash '{{.Path}}'"
    scripts = [
      "${path.root}/../../base/scripts/common_setup.sh",
      # "${path.root}/../../base/scripts/security_hardening.sh"
    ]
  }

  # Run CI runner-specific scripts
  provisioner "shell" {
    execute_command = "{{.Vars}} bash '{{.Path}}'"
    environment_vars = [
      "RUNNER_USER=${var.runner_user}",
      "ENVIRONMENT=${var.environment}"
    ]
    scripts = [
      "${path.root}/scripts/setup_ci_user.sh",
      "${path.root}/scripts/install_docker.sh",
      "${path.root}/scripts/pull_service_containers.sh",
      "${path.root}/scripts/install_gh_actions.sh",
      "${path.root}/scripts/install_build_tools.sh",
      "${path.root}/scripts/install_deploy_tools.sh",
      "${path.root}/scripts/install_ops_agent.sh",
      "${path.root}/scripts/disk_cache_tuning.sh",
    ]
  }

  # Copy letta_secrets_helper
  provisioner "file" {
    source      = "${path.root}/../../base/files/letta_secrets_helper.py"
    destination = "/tmp/letta_secrets_helper.py"
  }

  provisioner "shell" {
    inline = [
      "sudo mv /tmp/letta_secrets_helper.py /usr/local/bin/letta_secrets_helper",
      "sudo chmod +x /usr/local/bin/letta_secrets_helper"
    ]
  }

  # Create a virtual environment in a system location
  provisioner "shell" {
    inline = [
      "sudo python3 -m venv /opt/letta_secret_helper_env",
      "sudo /opt/letta_secret_helper_env/bin/pip install google-cloud-secret-manager"
    ]
  }

  # Copy any configuration files
  provisioner "file" {
    source      = "${path.root}/files/"
    destination = "/tmp/"
  }

  # Setup spot preemption monitor
  provisioner "shell" {
    inline = [
      "sudo mv /tmp/spot-preemption-monitor.sh /usr/local/bin/spot-preemption-monitor.sh",
      "sudo chmod +x /usr/local/bin/spot-preemption-monitor.sh",
      "sudo mv /tmp/spot-preemption-monitor.service /etc/systemd/system/spot-preemption-monitor.service",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable spot-preemption-monitor.service"
    ]
  }

  # Finalize setup
  provisioner "shell" {
    execute_command = "{{.Vars}} bash '{{.Path}}'"
    inline = [
      "sudo mv /tmp/daemon.json /etc/docker/daemon.json",
      "sudo systemctl restart docker",
      "sudo rm -rf /tmp/*",
      "sudo apt-get clean",
      "sudo apt-get autoremove -y",
    ]
  }
}
