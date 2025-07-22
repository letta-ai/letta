#!/bin/bash
set -e

PROVIDER=${1:-""}
ENVIRONMENT=${2:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "$PROVIDER" ]]; then
    echo "Usage: $0 <provider> [environment]"
    echo "Providers: ollama, vllm, lmstudio"
    echo "Environment: dev (default), prod"
    exit 1
fi

if [[ ! "$PROVIDER" =~ ^(ollama|vllm|lmstudio)$ ]]; then
    echo "Error: Provider must be 'ollama', 'vllm', or 'lmstudio'"
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(dev|prod)$ ]]; then
    echo "Error: Environment must be 'dev' or 'prod'"
    exit 1
fi

echo "Building GPU runner image with $PROVIDER provider for $ENVIRONMENT environment"

cd "$SCRIPT_DIR"

# Check if provider-specific variable file exists
VARS_FILE="variables/gpu-${PROVIDER}.pkrvars.hcl"
if [[ ! -f "$VARS_FILE" ]]; then
    echo "Error: Variable file $VARS_FILE not found"
    exit 1
fi

# Build the image
echo "Running packer build with $VARS_FILE..."
packer build \
    -var-file="$VARS_FILE" \
    -var="environment=$ENVIRONMENT" \
    -on-error=ask \
    gpu-runner.pkr.hcl

echo "GPU runner image with $PROVIDER provider build completed successfully!"
echo ""
echo "Usage examples:"
echo "  $0 ollama dev          # Build Ollama provider for dev"
echo "  $0 vllm prod           # Build vLLM provider for prod"
echo "  $0 lmstudio dev        # Build LMStudio provider for dev"
