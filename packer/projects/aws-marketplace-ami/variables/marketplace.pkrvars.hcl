# Variables for AWS Marketplace AMI build

# AMI Configuration
ami_name = "letta-cloud"
ami_description = "Letta Cloud Self-Hosted with PostgreSQL and ADE"

# Build Configuration
instance_type = "t3.medium"
region = "us-east-1"

# Source AMI - Ubuntu 22.04 LTS
source_ami_filter_name = "ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"
source_ami_owners = ["099720109477"] # Canonical
