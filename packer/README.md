# Packer GCP Monorepo Structure

This repository contains a structured approach to building GCP images with Packer in a monorepo pattern.

## Directory Structure

```
packer-gcp-monorepo/
├── packer/
│   ├── base/                # Base templates and common scripts
│   │   ├── scripts/         # Shared provisioning scripts
│   │   └── variables/       # Common variable definitions
│   ├── modules/             # Reusable Packer components
│   │   └── gcp-image/       # GCP-specific configurations
│   └── projects/            # Project-specific builds
│       └── ci-runners/      # CI runner image
│           ├── scripts/     # CI runner specific scripts
│           ├── variables/   # Environment-specific variables
│           └── files/       # Configuration files
```

## CI Runner Image

The CI runner image is configured to create a GCP image that can be referenced in our existing Terraform instance templates.

### Building the Image

To build the CI runner image:

```bash
cd packer/projects/ci-runners
./build.sh dev  # or prod for production environment
```

### Cleanup

To clean up old images:

```bash
cd packer/projects/ci-runners
./cleanup.sh dev my-project-id
```

## Integration with Terraform

In the Terraform code, you can reference the image family:

```hcl
resource "google_compute_instance_template" "ci_runner_template" {
  name_prefix  = "ci-runner-template-"
  machine_type = "c4a-standard-2"

  disk {
    source_image = "family/ci-runner-dev"  # Use the image family
    auto_delete  = true
    boot         = true
  }

  # Your existing network configuration
  network_interface {
    network = "default"
  }
}
```

## Customization

- Modify the scripts in `packer/projects/ci-runners/scripts/` to install additional tools
- Update environment-specific variables in `packer/projects/ci-runners/variables/`
- Add configuration files to `packer/projects/ci-runners/files/`

## Notes

- Image families automatically use the latest image in the family
- Each image is tagged with a timestamp for unique identification
- Environment-specific configurations allow different setups for dev and prod
