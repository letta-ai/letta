#!/bin/bash
# Build letta-web container locally for AMI inclusion
# Run this script from the project root before running Packer

set -e

echo "Building letta-web container locally..."

# Check if we're in the right directory
if [ ! -f "apps/web/Dockerfile" ]; then
    echo "ERROR: apps/web/Dockerfile not found"
    echo "Please run this script from the letta-cloud project root directory"
    exit 1
fi

# Create local-images directory
mkdir -p packer/projects/aws-marketplace-ami/local-images

# Build the letta-web container (from project root, not apps/web/)
echo "Building letta-web:local container for linux/amd64..."
docker build -t letta-web:local \
    --platform linux/amd64 \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --target web \
    -f apps/web/Dockerfile \
    .

echo "Saving letta-web container as tar.gz..."
docker save letta-web:local | gzip > packer/projects/aws-marketplace-ami/local-images/letta-web_local.tar.gz

# Verify the saved image
if [ -f "packer/projects/aws-marketplace-ami/local-images/letta-web_local.tar.gz" ]; then
    SIZE=$(du -h packer/projects/aws-marketplace-ami/local-images/letta-web_local.tar.gz | cut -f1)
    echo "✓ Successfully saved letta-web:local (${SIZE})"
    echo ""
    echo "Ready to run Packer build:"
    echo "  cd packer/projects/aws-marketplace-ami"
    echo "  ./build.sh"
else
    echo "ERROR: Failed to save container image"
    exit 1
fi

echo ""
echo "Note: You can now run the Packer build. The letta-web container will be included in the AMI."
echo "If you need to update the container, re-run this script before building the AMI."
