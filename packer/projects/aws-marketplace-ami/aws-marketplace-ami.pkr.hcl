packer {
  required_plugins {
    amazon = {
      version = ">= 1.2.8"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "instance_type" {
  type        = string
  description = "Instance type for building"
  default     = "t3.medium"
}

variable "ami_name" {
  type        = string
  description = "AMI name"
  default     = "letta-marketplace-ami"
}

variable "ami_description" {
  type        = string
  description = "AMI description"
  default     = "Letta AI Agent Platform with PostgreSQL and ADE"
}

variable "source_ami_filter_name" {
  type        = string
  description = "Source AMI name filter"
  default     = "ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"
}

variable "source_ami_owners" {
  type        = list(string)
  description = "Source AMI owners"
  default     = ["099720109477"] # Canonical
}

locals {
  timestamp = regex_replace(timestamp(), "[- TZ:]", "")
}

source "amazon-ebs" "letta-marketplace" {
  ami_name      = "${var.ami_name}-${local.timestamp}"
  ami_description = var.ami_description
  instance_type = var.instance_type
  region        = var.region

  source_ami_filter {
    filters = {
      name                = var.source_ami_filter_name
      root-device-type    = "ebs"
      virtualization-type = "hvm"
    }
    most_recent = true
    owners      = var.source_ami_owners
  }

  ssh_username = "ubuntu"

  tags = {
    Name        = "${var.ami_name}-${local.timestamp}"
    Environment = "marketplace"
    Service     = "letta"
    Component   = "multi-service"
    BuildTime   = timestamp()
  }
}

build {
  name = "letta-marketplace-ami"
  sources = [
    "source.amazon-ebs.letta-marketplace"
  ]

  # Common system setup
  provisioner "shell" {
    script = "../../base/scripts/common_setup.sh"
  }

  # Security hardening
  provisioner "shell" {
    script = "../../base/scripts/security_hardening.sh"
  }

  # Install Docker and Docker Compose
  provisioner "shell" {
    script = "./scripts/install_docker.sh"
  }

  # Copy Docker configurations
  provisioner "file" {
    source      = "./docker"
    destination = "/tmp/"
  }

  # Copy local images directory if it exists
  provisioner "file" {
    source      = "./local-images"
    destination = "/tmp/"
  }


  # Setup Docker environment
  provisioner "shell" {
    script = "./scripts/setup_docker_environment.sh"
  }

  # Pull and save container images to AMI
  provisioner "shell" {
    script = "./scripts/bake_containers.sh"
  }

  # Setup systemd service for container orchestration
  provisioner "file" {
    source      = "./files/letta-platform.service"
    destination = "/tmp/letta-platform.service"
  }

  # Copy management script
  provisioner "file" {
    source      = "./scripts/manage_platform.sh"
    destination = "/tmp/manage_platform.sh"
  }

  # Configure container orchestration service
  provisioner "shell" {
    script = "./scripts/configure_container_services.sh"
  }

  # Setup startup and health monitoring
  provisioner "file" {
    source      = "./files/startup.sh"
    destination = "/tmp/startup.sh"
  }

  provisioner "file" {
    source      = "./files/health_check.sh"
    destination = "/tmp/health_check.sh"
  }

  provisioner "shell" {
    script = "./scripts/setup_startup.sh"
  }

  # Final cleanup and preparation
  provisioner "shell" {
    script = "./scripts/cleanup.sh"
  }
}
