# Secret Manager Module

## Add a New Secret

1. Create a Terraform variable to recieve secret value at runtime in `variables.tf`:

```hcl
variable "dev_ci_gh-app-id" {
  type      = string
  sensitive = true
}
```

2. Tell Terraform to create the secret in GCP secrets manager in `main.tf`:

```hcl
locals {
  secrets = {
    "dev_ci_gh_app_id" = var.dev_ci_gh-app-id,
    # Other existing secrets...
  }
}
```

3. Create a runtime mapping of Terraform variable to 1Password secret identifier in `env_vars`:

```
TF_VAR_dev_dev_ci_gh_app_id="op://dev/dev_ci_gh-app-creds/app-id"
```

## Run Terraform with 1Password CLI

1. Sign in to 1Password CLI (if not already signed in):

```bash
op signin
```

2. Load environment variables from the env_vars file and run terraform:

```bash
# Initialize Terraform if needed
op run --env-file=./env_vars -- terraform init

# Plan the changes
op run --env-file=./env_vars -- terraform plan

# Apply the changes
op run --env-file=./env_vars -- terraform apply
```

The `op run` command injects the secrets from 1Password directly into the environment variables during execution, keeping your secrets secure and out of version control.
