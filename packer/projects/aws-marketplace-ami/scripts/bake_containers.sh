#!/bin/bash
# Pull and save container images to AMI for offline deployment

set -e

echo "Pulling and baking container images into AMI..."

cd /opt/letta-platform

# Source environment variables
if [ -f .env ]; then
    source .env
fi

# Create directory for saved images
sudo mkdir -p /opt/letta-platform/images
sudo chown ubuntu:ubuntu /opt/letta-platform/images

# Define images to pull and save
IMAGES=(
    "${POSTGRES_IMAGE:-ankane/pgvector:v0.5.1}"
    "${LETTA_SERVER_IMAGE:-letta/letta:latest}"
)

# Check for pre-built local images (copied from host)
LOCAL_IMAGE_DIR="/tmp/local-images"

# Function to pull and save an image
pull_and_save() {
    local image=$1
    local filename=$(echo "$image" | tr '/:' '_')

    echo "Pulling and saving $image..."

    # Pull the image
    if sudo docker pull "$image"; then
        echo "✓ Successfully pulled $image"

        # Save the image as a tar file
        sudo docker save "$image" | gzip > "/opt/letta-platform/images/${filename}.tar.gz"
        echo "✓ Saved $image to ${filename}.tar.gz"

        # Verify the saved image
        if [ -f "/opt/letta-platform/images/${filename}.tar.gz" ]; then
            local size=$(du -h "/opt/letta-platform/images/${filename}.tar.gz" | cut -f1)
            echo "✓ Image saved successfully (${size})"
        else
            echo "⚠ Failed to save $image"
            return 1
        fi
    else
        echo "⚠ Failed to pull $image"
        return 1
    fi
}

# Pull and save required images
for image in "${IMAGES[@]}"; do
    if ! pull_and_save "$image"; then
        echo "ERROR: Failed to process required image $image"
        exit 1
    fi
done

# Load pre-built local images if available
LETTA_WEB_AVAILABLE=false
if [ -d "$LOCAL_IMAGE_DIR" ]; then
    echo "Loading pre-built local images from $LOCAL_IMAGE_DIR..."
    for image_tar in "$LOCAL_IMAGE_DIR"/*.tar.gz; do
        if [ -f "$image_tar" ]; then
            echo "Loading $(basename "$image_tar")..."
            if gunzip -c "$image_tar" | sudo docker load; then
                echo "✓ Successfully loaded $(basename "$image_tar")"

                # Check if this is the letta-web image
                if [[ "$(basename "$image_tar")" == *"letta-web"* ]]; then
                    LETTA_WEB_AVAILABLE=true
                fi

                # Copy to our images directory for consistency
                cp "$image_tar" "/opt/letta-platform/images/"
            else
                echo "⚠ Failed to load $(basename "$image_tar")"
            fi
        fi
    done
else
    echo "ℹ No local images directory found at $LOCAL_IMAGE_DIR"
fi

# Create conditional docker-compose configuration based on available images
if [ "$LETTA_WEB_AVAILABLE" = true ]; then
    echo "✓ Letta-web image available - web interface will be enabled"
    # Uncomment the letta_web service in docker-compose.yml
    sudo sed -i 's/^  #letta_web:/  letta_web:/' /opt/letta-platform/docker-compose.yml
    sudo sed -i 's/^  #  /    /' /opt/letta-platform/docker-compose.yml
else
    echo "ℹ Letta-web image not available - only API server will run"
    echo "ℹ To enable web interface, run build-web-image.sh and rebuild AMI"
    # Web service stays commented out (default state)
fi

# Create a script to load all saved images
sudo tee /opt/letta-platform/load_images.sh << 'EOF'
#!/bin/bash
# Load all saved container images

set -e

echo "Loading saved container images..."

IMAGE_DIR="/opt/letta-platform/images"

if [ ! -d "$IMAGE_DIR" ]; then
    echo "ERROR: Images directory not found at $IMAGE_DIR"
    exit 1
fi

# Load all tar.gz files in the images directory
for image_file in "$IMAGE_DIR"/*.tar.gz; do
    if [ -f "$image_file" ]; then
        echo "Loading $(basename "$image_file")..."
        if gunzip -c "$image_file" | docker load; then
            echo "✓ Successfully loaded $(basename "$image_file")"
        else
            echo "⚠ Failed to load $(basename "$image_file")"
        fi
    fi
done

echo "Finished loading saved images."

# Show loaded images
echo "Available Docker images:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | head -10
EOF

sudo chmod +x /opt/letta-platform/load_images.sh
sudo chown ubuntu:ubuntu /opt/letta-platform/load_images.sh

# Set proper ownership on images directory
sudo chown -R ubuntu:ubuntu /opt/letta-platform/images

# Show summary
echo "Container baking completed!"
echo "Saved images:"
ls -lh /opt/letta-platform/images/

# Calculate total size
TOTAL_SIZE=$(du -sh /opt/letta-platform/images | cut -f1)
echo "Total size of saved images: $TOTAL_SIZE"

# Clean up the pulled images from Docker to save space
echo "Cleaning up Docker images to save AMI space..."
sudo docker system prune -f

echo "Container images have been baked into the AMI successfully!"
