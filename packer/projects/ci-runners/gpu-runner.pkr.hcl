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
  default = "g2-standard-24" # gpu instances
}

variable "disk_type" {
  type    = string
  default = "pd-standard"
}

variable "disk_size" {
  type    = string
  default = "100"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "runner_user" {
  type    = string
  default = "ci-runner"
}

variable "image_prefix" {
  type    = string
  default = "gpu-runner"
}

variable "self_hosted_provider" {
  type        = string
  default     = ""
  description = "Self-hosted provider to install (ollama, vllm, lmstudio, or empty for all)"
}

source "googlecompute" "gpu_runner" {
  project_id          = var.project_id
  source_image_family = "ubuntu-2404-lts-amd64"
  zone                = var.zone
  machine_type        = var.machine_type
  disk_type           = var.disk_type
  disk_size           = var.disk_size
  image_name          = "${var.image_prefix}${var.self_hosted_provider != "" ? "-${var.self_hosted_provider}" : ""}-${var.environment}-${local.timestamp}"
  image_family        = "${var.image_prefix}${var.self_hosted_provider != "" ? "-${var.self_hosted_provider}" : ""}-${var.environment}"
  image_description   = "GPU-enabled CI Runner${var.self_hosted_provider != "" ? " with ${var.self_hosted_provider}" : ""} for self-hosted LLM testing - ${var.environment} environment"

  on_host_maintenance = "TERMINATE"
  accelerator_type    = "projects/memgpt-428419/zones/us-east1-b/acceleratorTypes/nvidia-l4"
  accelerator_count   = 2

  ssh_username        = "letta"
}

build {
  sources = ["source.googlecompute.gpu_runner"]

  # Run common setup scripts
  provisioner "shell" {
    execute_command = "{{.Vars}} bash '{{.Path}}'"
    scripts = [
      "${path.root}/../../base/scripts/common_setup.sh",
    ]
  }

  # Run CI runner-specific scripts (install Docker first)
  provisioner "shell" {
    execute_command = "{{.Vars}} bash '{{.Path}}'"
    environment_vars = [
      "RUNNER_USER=${var.runner_user}",
      "ENVIRONMENT=${var.environment}",
      "SELF_HOSTED_PROVIDER=${var.self_hosted_provider}"
    ]
    scripts = [
      "${path.root}/scripts/setup_ci_user.sh",
      "${path.root}/scripts/install_docker.sh",
      "${path.root}/scripts/install_gh_actions.sh",
      "${path.root}/scripts/install_build_tools.sh",
      "${path.root}/scripts/install_ops_agent.sh",
    ]
  }

  # Install NVIDIA drivers and CUDA after Docker is installed
  provisioner "shell" {
    execute_command = "{{.Vars}} bash '{{.Path}}'"
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y ubuntu-drivers-common",
      "sudo ubuntu-drivers autoinstall",
      "wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb",
      "sudo dpkg -i cuda-keyring_1.1-1_all.deb",
      "sudo apt-get update",
      "sudo apt-get install -y cuda-toolkit-12-6",
      "sudo apt-get install -y nvidia-container-toolkit",
    ]
  }

  # provider Specific Setup
  provisioner "shell" {
    execute_command = "{{.Vars}} bash '{{.Path}}'"
    environment_vars = [
      "RUNNER_USER=${var.runner_user}",
      "ENVIRONMENT=${var.environment}",
      "SELF_HOSTED_PROVIDER=${var.self_hosted_provider}"
    ]
    scripts = [
      "${path.root}/scripts/self-hosted-providers/setup_ollama.sh",
      "${path.root}/scripts/self-hosted-providers/setup_lmstudio.sh",
      "${path.root}/scripts/self-hosted-providers/setup_vllm.sh",
    ]
  }

  # Pull service containers after Docker and GPU support is ready
  provisioner "shell" {
    execute_command = "{{.Vars}} bash '{{.Path}}'"
    environment_vars = [
      "RUNNER_USER=${var.runner_user}",
      "ENVIRONMENT=${var.environment}"
    ]
    scripts = [
      "${path.root}/scripts/pull_service_containers.sh",
    ]
  }

  # Copy letta secrets helper
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

  # Create virtual environment for secrets helper
  provisioner "shell" {
    inline = [
      "sudo python3 -m venv /opt/letta_secret_helper_env",
      "sudo /opt/letta_secret_helper_env/bin/pip install google-cloud-secret-manager"
    ]
  }

  # Copy configuration files
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

  # Final setup
  provisioner "shell" {
    execute_command = "{{.Vars}} bash '{{.Path}}'"
    inline = [
      # GPU runner needs the nvidia-container-runtime
      "sudo mv /tmp/daemon-gpu.json /etc/docker/daemon.json",
      "sudo systemctl restart docker",
      "sudo rm -rf /tmp/*",
      "sudo apt-get clean",
      "sudo apt-get autoremove -y",
    ]
  }
}
