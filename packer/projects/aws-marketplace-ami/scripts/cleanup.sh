#!/bin/bash
# Cleanup script for AMI preparation (Containerized)

set -e

echo "Running AMI cleanup for containerized environment..."

# Stop all containers and remove them
echo "Stopping and cleaning Docker containers..."
cd /opt/letta-platform
sudo docker-compose --env-file=.env down --volumes --remove-orphans || true

# Clean Docker system (but preserve our baked images)
echo "Cleaning Docker system (preserving baked images)..."
# Only remove running containers and unused networks, keep our saved images
sudo docker container prune -f || true
sudo docker network prune -f || true
# Note: We keep our saved image files in /opt/letta-platform/images/

# Stop Docker service for cleanup
echo "Stopping Docker service..."
sudo systemctl stop docker || true

# Clean package cache
echo "Cleaning package cache..."
sudo apt-get clean
sudo apt-get autoremove -y

# Clean logs
echo "Cleaning system logs..."
sudo truncate -s 0 /var/log/*log 2>/dev/null || true
sudo truncate -s 0 /var/log/syslog 2>/dev/null || true
sudo rm -rf /var/log/journal/* 2>/dev/null || true

# Clean container logs (if any exist)
sudo rm -rf /var/lib/docker/containers/*/log* 2>/dev/null || true

# Clean temporary files
echo "Cleaning temporary files..."
sudo rm -rf /tmp/*
sudo rm -rf /var/tmp/*

# Clean SSH host keys (will be regenerated on first boot)
echo "Cleaning SSH host keys..."
sudo rm -f /etc/ssh/ssh_host_*

sudo rm /root/.ssh/authorized_keys
sudo rm /home/ubuntu/.ssh/authorized_keys

# Clean bash history
echo "Cleaning bash history..."
history -c
history -w
rm -f ~/.bash_history
sudo rm -f /root/.bash_history

# Clean cloud-init logs and cache
echo "Cleaning cloud-init..."
sudo cloud-init clean --logs || true

# Remove any Packer-related temporary files
sudo rm -f /tmp/packer_*
sudo rm -rf /tmp/docker

# Ensure proper permissions on platform directory
echo "Setting final permissions..."
sudo chown -R ubuntu:ubuntu /opt/letta-platform
sudo chmod +x /opt/letta-platform/load_images.sh

# Create welcome message
sudo tee /etc/motd << 'EOF'
========================================
  Letta AI Agent Platform AMI (Containerized)
========================================

This AMI includes containerized services:
- PostgreSQL 15 with pgvector extension
- Letta AI Agent Platform Server
- Letta Web Interface

Services run in Docker containers:
- PostgreSQL: Port 5432
- Letta Server API: Port 8083
- Letta Web: Port 8080

Management Commands:
- letta-start     : Start platform
- letta-stop      : Stop platform
- letta-status    : Check status
- letta-logs      : View logs

Health Check: /opt/health_check.sh
Platform Directory: /opt/letta-platform

For support, visit: https://letta.com
========================================
EOF

# Restart Docker to ensure clean state
echo "Restarting Docker service..."
sudo systemctl start docker
sudo systemctl stop docker

# Sync filesystem
echo "Syncing filesystem..."
sync

echo "AMI cleanup completed successfully!"
