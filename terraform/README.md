# Terraform Infrastructure

This repository contains the Terraform code for managing our company's infrastructure across multiple environments and regions.

## Structure

The codebase follows a modular pattern with clear separation between reusable modules and environment-specific configurations:

```
├── README.md
├── configurations
│   ├── dev
│   │   ├── cluster
│   │   │   ├── main.tf
│   │   │   └── variables.tf
│   │   ├── database
│   │   │   ├── main.tf
│   │   │   └── variables.tf
│   │   ├── networking
│   │   │   └── main.tf
│   │   └── registry
│   │       └── main.tf
│   └── prod
│       └── cluster
│           ├── main.tf
│           ├── outputs.tf
│           └── variables.tf
└── modules
    ├── cluster
    │   ├── cluster.tf
    │   └── variables.tf
    ├── database
    │   ├── database.tf
    │   └── variables.tf
    ├── networking
    │   ├── main.tf
    │   ├── outputs.tf
    │   └── variables.tf
    └── registry
        ├── registry.tf
        └── variables.tf
```

### Modules

The `modules/` directory contains reusable infrastructure components that can be parameterized and instantiated across different environments:

- **cluster**: Infrastructure for container orchestration environments
- **database**: Database resources and configurations
- **networking**: Network resources (e.g. VPC networks) and configurations
- **registry**: Container registry infrastructure

### Configurations

The `configurations/` directory contains environment-specific implementations of our modules:

- **dev**: Development environment configurations
  - **cluster**: Dev environment's cluster infra
  - **networking**: Instantiates networking resources like VPCs and their networks
  - **database**: Development database infra
  - **registry**: Dev environment's docker registry infra (pubsub to come 😉)


~~**prod**: Production environment configurations **cluster**: Production cluster configuration~~

## Usage

### Creating a New Configuration

To create a new configuration for an existing module:

1. Create a new directory under the appropriate environment in `configurations/`
2. Create the necessary Terraform files:
   - `main.tf` - Module instantiation with environment-specific parameters
   - `variables.tf` - Input variables declaration
   - `outputs.tf` - Output values

Example:

```hcl
# configurations/dev/new-service/main.tf
terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/dev/new-service"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = "memgpt-428419"
  region  = "us-central1"
}

module "new_service" {
  source = "../../../modules/my-module"

  environment = "dev"
  instance_size = "small"
  # other parameters...
}
```

### Deploying Infrastructure

To deploy a specific configuration:

```bash
# Navigate to the configuration directory
cd configurations/dev/cluster

# Initialize Terraform
terraform init

# Create an execution plan
terraform plan

# Apply the changes
terraform apply
```

### Creating a New Module

To create a new reusable module:

1. Create a new directory under `modules/`
2. Create the necessary Terraform files:
   - `main.tf` - Core resource definitions
   - `variables.tf` - Input variables declaration
   - `outputs.tf` - Output values

## Best Practices

1. **State Management**: Use remote state with appropriate locking mechanisms.
2. **Secrets Management**: Never commit secrets to version control.
3. **Code Reviews**: All infrastructure changes should go through code review.
4. **Consistent Naming**: Follow the established naming conventions for resources.
5. **Testing**: Test changes in the development environment before deploying to production.
6. **Documentation**: Document module inputs, outputs, and purpose.
