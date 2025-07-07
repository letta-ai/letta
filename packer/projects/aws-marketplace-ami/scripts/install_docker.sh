#!/bin/bash
# Install Docker and Docker Compose for Letta AMI

set -e

echo "Installing Docker and Docker Compose..."

# Wait for any package operations to complete
echo "Waiting for package lock to be released..."
while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || sudo fuser /var/lib/dpkg/lock >/dev/null 2>&1; do
    echo "Waiting for package manager to be available..."
    sleep 5
done

# Update package list
echo "Updating package list..."
sudo apt-get update --fix-missing

# Install prerequisites
echo "Installing prerequisites..."
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    apt-transport-https \
    software-properties-common

# Add Docker's official GPG key
echo "Adding Docker GPG key..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set proper permissions on GPG key
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "Adding Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package list with Docker repo
echo "Updating package list with Docker repository..."
sudo apt-get update

# Install Docker Engine, CLI, and Docker Compose
echo "Installing Docker packages..."
sudo apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

# Start and enable Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Install Docker Compose standalone (for compatibility)
echo "Installing Docker Compose standalone..."
DOCKER_COMPOSE_VERSION="v2.24.5"
COMPOSE_URL="https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)"

# Download with retry logic
for i in {1..3}; do
    if sudo curl -L "$COMPOSE_URL" -o /usr/local/bin/docker-compose; then
        echo "✓ Docker Compose downloaded successfully"
        break
    else
        echo "⚠ Docker Compose download failed (attempt $i/3)"
        if [ $i -eq 3 ]; then
            echo "ERROR: Failed to download Docker Compose after 3 attempts"
            exit 1
        fi
        sleep 5
    fi
done

sudo chmod +x /usr/local/bin/docker-compose

# Create symlink for docker-compose
sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Configure Docker daemon for production
sudo tee /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "live-restore": true,
  "userland-proxy": false,
  "no-new-privileges": true
}
EOF

# Restart Docker to apply configuration
sudo systemctl restart docker

# Verify installation
echo "Verifying Docker installation..."
if sudo docker --version; then
    echo "✓ Docker CLI is working"
else
    echo "ERROR: Docker CLI is not working"
    exit 1
fi

if sudo docker-compose --version; then
    echo "✓ Docker Compose is working"
else
    echo "ERROR: Docker Compose is not working"
    exit 1
fi

# Test Docker daemon
echo "Testing Docker daemon..."
if sudo docker info >/dev/null 2>&1; then
    echo "✓ Docker daemon is running"
else
    echo "ERROR: Docker daemon is not accessible"
    exit 1
fi

# Note: Container images will be baked into the AMI by a separate script
# This approach provides faster startup and offline capability
echo "Container images will be baked into the AMI for offline deployment"

echo "Docker and Docker Compose installation completed successfully!"
