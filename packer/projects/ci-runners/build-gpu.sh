#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
PROVIDER=${2:-""}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "$PROVIDER" ]]; then
    echo "Building GPU runner image for environment: $ENVIRONMENT with provider: $PROVIDER"
else
    echo "Building GPU runner image for environment: $ENVIRONMENT with all providers"
fi

cd "$SCRIPT_DIR"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|prod)$ ]]; then
    echo "Error: Environment must be 'dev' or 'prod'"
    exit 1
fi

# Validate provider if specified
if [[ -n "$PROVIDER" && ! "$PROVIDER" =~ ^(ollama|vllm|lmstudio)$ ]]; then
    echo "Error: Provider must be 'ollama', 'vllm', 'lmstudio', or empty for all"
    exit 1
fi

# Check if variable file exists
VARS_FILE="variables/gpu.pkrvars.hcl"
if [[ ! -f "$VARS_FILE" ]]; then
    echo "Error: Variable file $VARS_FILE not found"
    exit 1
fi

# Build the image
echo "Running packer build..."
if [[ -n "$PROVIDER" ]]; then
    packer build \
        -var-file="$VARS_FILE" \
        -var="environment=$ENVIRONMENT" \
        -var="self_hosted_provider=$PROVIDER" \
        -on-error=ask \
        gpu-runner.pkr.hcl
else
    packer build \
        -var-file="$VARS_FILE" \
        -var="environment=$ENVIRONMENT" \
        -on-error=ask \
        gpu-runner.pkr.hcl
fi

if [[ -n "$PROVIDER" ]]; then
    echo "GPU runner image with $PROVIDER provider build completed successfully!"
else
    echo "GPU runner image with all providers build completed successfully!"
fi

echo ""
echo "Usage examples:"
echo "  $0 dev                 # Build with all providers for dev"
echo "  $0 prod ollama         # Build with only Ollama for prod"
echo "  $0 dev vllm            # Build with only vLLM for dev"
echo "  $0 prod lmstudio       # Build with only LMStudio for prod"
