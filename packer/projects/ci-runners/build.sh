#!/bin/bash
# CI Runner image build script

set -e

# Default to dev environment if not specified
ENVIRONMENT=${1:-dev}
PACKER_LOG=$2

# Navigate to the correct directory regardless of where the script is called from
cd "$(dirname "$0")"

echo "Building CI runner image for $ENVIRONMENT environment..."

# Run packer with appropriate variables
# $PACKER_LOG
packer build \
  -var-file="../../base/variables/common.pkrvars.hcl" \
  -var-file="./variables/${ENVIRONMENT}.pkrvars.hcl" \
  ./base-runner.pkr.hcl
