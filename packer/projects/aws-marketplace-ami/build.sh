#!/bin/bash
# Build script for Letta AWS Marketplace AMI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default values
ENVIRONMENT="marketplace"
REGION="us-east-1"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --environment    Environment (default: marketplace)"
            echo "  -r, --region         AWS region (default: us-east-1)"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "Building Letta AWS Marketplace AMI..."
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"

# Ensure local-images directory exists (Packer needs it to exist)
echo "Checking for local container images..."
if [ ! -d "./local-images" ]; then
    echo "Creating empty local-images directory for Packer..."
    mkdir -p ./local-images
fi

if [ "$(ls -A ./local-images 2>/dev/null)" ]; then
    echo "✓ Found local images, they will be included in the AMI:"
    ls -la ./local-images/
else
    echo "⚠ No local images found!"
    echo "ℹ The letta-web container will not be available in the AMI."
    echo "ℹ To include it, run: ./build-web-image.sh"
    echo ""
    read -p "Continue without letta-web container? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Build cancelled. Run ./build-web-image.sh first."
        exit 1
    fi
fi

# Validate required tools
if ! command -v packer &> /dev/null; then
    echo "Error: Packer is not installed or not in PATH"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed or not in PATH"
    exit 1
fi

# Validate AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS credentials not configured or invalid"
    exit 1
fi

# Set variables file
VARS_FILE="variables/${ENVIRONMENT}.pkrvars.hcl"

if [ ! -f "$VARS_FILE" ]; then
    echo "Error: Variables file not found: $VARS_FILE"
    exit 1
fi

# Validate Packer template
echo "Validating Packer template..."
packer validate -var-file="$VARS_FILE" -var="region=$REGION" aws-marketplace-ami.pkr.hcl

# Build the AMI
echo "Building AMI..."
packer build -var-file="$VARS_FILE" -var="region=$REGION" aws-marketplace-ami.pkr.hcl

echo "AMI build completed successfully!"
echo "Check the output above for the AMI ID."
