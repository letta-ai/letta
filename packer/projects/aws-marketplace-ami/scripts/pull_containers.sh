#!/bin/bash
# Pull container images for Letta AMI

set -e

echo "Pulling container images for Letta Platform..."

cd /opt/letta-platform

# Source environment variables
if [ -f .env ]; then
    source .env
fi

# Define images to pull with fallbacks
IMAGES=(
    "${POSTGRES_IMAGE:-ankane/pgvector:v0.5.1}"
    "${LETTA_SERVER_IMAGE:-letta/letta:latest}"
    "${LETTA_WEB_IMAGE:-us-central1-docker.pkg.dev/memgpt-428419/letta/web:latest}"
)

# Pull each image with retry logic
for image in "${IMAGES[@]}"; do
    echo "Pulling $image..."

    # Try pulling the image up to 3 times
    for attempt in {1..3}; do
        if sudo docker pull "$image"; then
            echo "✓ Successfully pulled $image"
            break
        else
            echo "⚠ Failed to pull $image (attempt $attempt/3)"
            if [ $attempt -eq 3 ]; then
                echo "ERROR: Failed to pull $image after 3 attempts"
                # Don't exit completely, continue with other images
                echo "Continuing with remaining images..."
            else
                echo "Retrying in 10 seconds..."
                sleep 10
            fi
        fi
    done
done

# Verify images are available
echo "Verifying pulled images..."
for image in "${IMAGES[@]}"; do
    if sudo docker images --format "table {{.Repository}}:{{.Tag}}" | grep -q "$(echo $image | cut -d: -f1)"; then
        echo "✓ $image is available locally"
    else
        echo "⚠ $image not found locally"
    fi
done

# Optional: Run docker compose pull to ensure all images are current
echo "Running docker-compose pull to ensure all images are current..."
if sudo docker-compose pull --ignore-pull-failures; then
    echo "✓ Docker Compose pull completed"
else
    echo "⚠ Docker Compose pull had some failures, but continuing..."
fi

# List final images
echo "Available container images:"
sudo docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | head -10

echo "Container image pulling completed!"
