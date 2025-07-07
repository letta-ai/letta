#!/bin/bash
# Common setup script for all images

set -e

echo "Running common setup script..."

# Wait for cloud-init to finish
echo "Waiting for cloud-init to complete..."
sudo cloud-init status --wait || true

# Update package sources
echo "Updating package sources..."
sudo apt-get update --fix-missing
sudo apt-get upgrade -y

# Install essential packages first
echo "Installing essential packages..."
sudo apt-get install -y \
  curl \
  wget \
  git \
  unzip \
  software-properties-common \
  apt-transport-https \
  ca-certificates \
  gnupg \
  lsb-release

# Install additional utilities (with error handling)
echo "Installing additional utilities..."
PACKAGES=(
  "htop"
  "vim"
  "tmux"
  "net-tools"
  "rsync"
)

for package in "${PACKAGES[@]}"; do
  if sudo apt-get install -y "$package"; then
    echo "✓ Successfully installed $package"
  else
    echo "⚠ Failed to install $package, continuing..."
  fi
done

# Install jq separately with fallback
echo "Installing jq..."
if ! sudo apt-get install -y jq; then
  echo "jq not available in repositories, installing from GitHub..."
  JQ_VERSION="1.7.1"
  curl -L "https://github.com/jqlang/jq/releases/download/jq-${JQ_VERSION}/jq-linux-amd64" -o /tmp/jq
  sudo chmod +x /tmp/jq
  sudo mv /tmp/jq /usr/local/bin/jq
  echo "✓ jq installed from GitHub"
fi

# Verify jq installation
if command -v jq &> /dev/null; then
  echo "✓ jq is available: $(jq --version)"
else
  echo "⚠ jq installation failed, but continuing..."
fi

# Set timezone
echo "Setting timezone to UTC..."
sudo timedatectl set-timezone UTC

# Basic security configurations
echo "Applying basic security configurations..."
sudo sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config

# Ensure SSH service is enabled
sudo systemctl enable ssh

echo "Common setup completed successfully!"
