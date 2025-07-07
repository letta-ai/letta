#!/bin/bash
# Setup Docker environment for Letta AMI

set -e

echo "Setting up Docker environment..."

# Create letta platform directory
sudo mkdir -p /opt/letta-platform
sudo chown ubuntu:ubuntu /opt/letta-platform

# Copy Docker configurations
sudo cp -r /tmp/docker/* /opt/letta-platform/
sudo chown -R ubuntu:ubuntu /opt/letta-platform

# The .env file should already be copied from /tmp/docker/.env
# This is just a fallback in case it's missing
if [ ! -f /opt/letta-platform/.env ]; then
    echo "Creating fallback .env file..."
    sudo tee /opt/letta-platform/.env << EOF
# Letta Platform Environment Configuration
COMPOSE_PROJECT_NAME=letta-platform

# Database settings
LETTA_PG_DB=letta
LETTA_PG_USER=letta
LETTA_PG_PASSWORD=letta

# PostgreSQL container settings
POSTGRES_DB=letta
POSTGRES_USER=letta
POSTGRES_PASSWORD=letta

# Container versions (can be updated for different releases)
LETTA_SERVER_IMAGE=letta/letta:latest
LETTA_WEB_IMAGE=letta-web:local
POSTGRES_IMAGE=ankane/pgvector:v0.5.1
EOF
fi

sudo chown ubuntu:ubuntu /opt/letta-platform/.env

# Create log directories
sudo mkdir -p /opt/letta-platform/logs
sudo chown -R ubuntu:ubuntu /opt/letta-platform/logs

# Set proper permissions on any scripts that were copied
find /opt/letta-platform -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

# Create Docker network (it will be recreated on first boot, but this ensures it exists)
sudo docker network create letta-network || true

echo "Docker environment setup completed!"
