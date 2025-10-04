terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/prod/model-serving"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.30"
    }
  }
}

# locals {
#   env     = "prod"
#   region  = "us-central1"
#   service = "model-serving"
#   zone    = "us-central1-a"
# }

provider "google" {
  project = "memgpt-428419"
  region  = var.region
}

data "google_project" "project" {}

data "google_compute_network" "vpc_network" {
  name = "letta-vpc"
}

data "google_compute_subnetwork" "subnet" {
  name   = "letta-subnet"
  region = var.region
}

resource "google_service_account" "vllm_sa" {
  account_id   = "vllm-server-${var.env}-sa"
  display_name = "vLLM Server Service Account in ${var.env}"
  description  = "Service account for vLLM model serving in ${var.env} environment"
}

resource "google_compute_instance" "letta_model_server" {
  name         = "vllm-7b-server-${var.env}"
  machine_type = "g2-standard-8"
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = "projects/deeplearning-platform-release/global/images/family/pytorch-2-7-cu128-ubuntu-2204-nvidia-570"
      size  = 100
      type  = "pd-ssd"
    }
  }

  guest_accelerator {
    type  = "nvidia-l4"
    count = 1
  }

  scheduling {
    on_host_maintenance = "TERMINATE"
  }

  network_interface {
    network    = data.google_compute_network.vpc_network.name
    subnetwork = data.google_compute_subnetwork.subnet.name
  }

  service_account {
    email  = google_service_account.vllm_sa.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    install-nvidia-driver = "True"
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    set -e

    apt-get update

    curl -LsSf https://astral.sh/uv/install.sh | sh
    source $HOME/.cargo/env

    /root/.cargo/bin/uv install vllm[all]
    nohup /root/.cargo/bin/uv run python -m vllm.entrypoints.openai.api_server \
      --model letta-ai/qwen8b-letta-sft-10k \
      --served-model-name letta-sonoma-sunset \
      --reasoning-parser deepseek_r1 \
      --enable-auto-tool-choice \
      --tool-call-parser hermes \
      --port 8000 \
      --host 0.0.0.0 \
      --max-model-len 22928 > /var/log/vllm.log 2>&1 &

  EOF

  tags = ["vllm-server", "http-server"]
}

resource "google_compute_firewall" "vllm_firewall" {
  name    = "allow-internal-to-vllm-${var.env}"
  network = data.google_compute_network.vpc_network.name

  allow {
    protocol = "all"
  }

  source_ranges = [
    "10.0.0.0/16",   # VPC subnet
    "10.92.0.0/14"   # GKE pod CIDR
  ]

  target_tags = ["vllm-server"]
  priority    = 900

  description = "Allow all internal VPC and GKE pod traffic to vllm servers"
}
