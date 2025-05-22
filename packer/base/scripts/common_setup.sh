#!/bin/bash
# Common setup script for all images

set -e

echo "Running common setup script..."

# Update system packages
sudo apt-get update
sudo apt-get upgrade -y

# Install common utilities
sudo apt-get install -y \
  curl \
  wget \
  git \
  unzip \
  jq \
  htop \
  vim \
  tmux
# Set timezone
sudo timedatectl set-timezone UTC

# Basic security configurations
sudo sed -i 's/^PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config

echo "Common setup completed"
