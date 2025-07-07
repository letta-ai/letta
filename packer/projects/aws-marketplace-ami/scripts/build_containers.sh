#!/bin/bash
# Build container images for Letta AMI

set -e

echo "Building container images..."

cd /opt/letta-platform

# Build Letta container image
echo "Building Letta container..."
sudo docker build -t letta:marketplace ./letta/

# Build ADE container image
echo "Building ADE container..."
sudo docker build -t ade:marketplace ./ade/

# Verify images were built
echo "Verifying built images..."
sudo docker images | grep -E "(letta|ade):marketplace"

# Tag images for local registry (optional, for organization)
sudo docker tag letta:marketplace localhost/letta:latest
sudo docker tag ade:marketplace localhost/ade:latest

# Clean up build cache to save space
sudo docker builder prune -f

echo "Container images built successfully!"

# List final images
echo "Available images:"
sudo docker images
