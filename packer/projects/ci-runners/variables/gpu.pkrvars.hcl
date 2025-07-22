project_id   = "memgpt-428419"
zone         = "us-east1-b"
machine_type = "g2-standard-24"
disk_type    = "pd-standard"
disk_size    = "100"
environment  = "dev"
runner_user  = "ci-runner"
image_prefix = "gpu-runner"

# Self-hosted provider configuration
# Leave empty for all providers, or specify: "ollama", "vllm", "lmstudio"
self_hosted_provider = ""
