terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/prod/ci_runners"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
    }
  }
}

provider "google" {
  project = "memgpt-428419"
  region  = "us-central1"
}

# cypress crashed on a runner with 8GB of RAM
module medium_runners {
  source = "../../../modules/gcp_mig"

  # global
  env = "dev"
  project_id = "memgpt-428419"
  region = "us-central1"
  zone = "us-central1-a"

  # pool-level config
  pool_name_prefix = "ci-runners-medium"
  runner_labels = "medium"
  runner_image = "family/ci-runner-dev"
  machine_type = "c4a-highmem-2" # 2 CPUs and 16GB Memory
  ssh_pubkey = "letta:ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILflk18SwzkU5NS9CPylt3vszYJas365wX7OCTbxPWXw"
  sa_email = "ci-runner-sa-dev@memgpt-428419.iam.gserviceaccount.com"

  # disk
  disk_type = "hyperdisk-balanced" # required for c4a instances (high performance but cheaper cause ARM)
  disk_size_gb = 128

  # repo config
  github_org = "letta-ai"
  github_repo = "letta-cloud"

  # auto scaling config
  min_runners = 17
  max_runners = 17
}

# hitting CPU quota on GCP bc all runners were sized to support cypress, so trying with smaller runners
module small_runners {
  source = "../../../modules/gcp_mig"

  # global
  env = "dev"
  project_id = "memgpt-428419"
  region = "us-central1"
  zone = "us-central1-c"

  # pool-level config
  pool_name_prefix = "ci-runners-small"
  runner_labels = "small"
  runner_image = "family/ci-runner-dev"
  machine_type = "c4a-standard-1" # 1 CPU and 4GB Memory
  ssh_pubkey = "letta:ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILflk18SwzkU5NS9CPylt3vszYJas365wX7OCTbxPWXw"
  sa_email = "ci-runner-sa-dev@memgpt-428419.iam.gserviceaccount.com"

  # disk
  disk_type = "hyperdisk-balanced" # required for c4a instances (high performance but cheaper cause ARM)
  disk_size_gb = 128

  # repo config
  github_org = "letta-ai"
  github_repo = "letta-cloud"

  # auto scaling config
  min_runners = 26
  max_runners = 26
}

#ollama
module ollama_gpu_runners {
  source = "../../../modules/gcp_mig"

  # global
  env = "dev"
  project_id = "memgpt-428419"
  region = "us-central1"
  zone = "us-central1-b"

  # pool-level config
  # gpu runners use the same image but have different startup commands
  pool_name_prefix = "ci-runners-gpu-ollama"
  runner_labels = "gpu,ollama"
  runner_image = "family/gpu-runner-dev"
  machine_type = "g2-standard-24"
  ssh_pubkey = "letta:ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILflk18SwzkU5NS9CPylt3vszYJas365wX7OCTbxPWXw"
  sa_email = "ci-runner-sa-dev@memgpt-428419.iam.gserviceaccount.com"

  # disk
  disk_type = "pd-standard" # required for gpu instances (does not support hyperdisk)
  disk_size_gb = 128

  # repo config
  github_org = "letta-ai"
  github_repo = "letta-cloud"

  final_steps = file("${path.module}/files/ollama-final-steps.sh")

  # auto scaling config
  min_runners = 1
  max_runners = 1
}


# lmstudio
# module gpu_runners {
#   source = "../../../modules/gcp_mig"

#   # global
#   env = "dev"
#   project_id = "memgpt-428419"
#   region = "us-central1"
#   zone = "us-central1-a"

#   # pool-level config
#   pool_name_prefix = "ci-runners-gpu-lmstudio"
#   runner_labels = "gpu,lmstudio"
#   runner_image = "family/gpu-runner-dev"
#   machine_type = "e2-standard-8"
#   ssh_pubkey = "letta:ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILflk18SwzkU5NS9CPylt3vszYJas365wX7OCTbxPWXw"
#   sa_email = "ci-runner-sa-dev@memgpt-428419.iam.gserviceaccount.com"

#   # disk
#   disk_type = "pd-standard" # required for gpu instances (does not support hyperdisk)
#   disk_size_gb = 128

#   # repo config
#   github_org = "letta-ai"
#   github_repo = "letta-cloud"

#   final_steps = file("${path.module}/files/lmstudio-final-steps.sh")

#   # auto scaling config
#   min_runners = 1
#   max_runners = 1
# }

# vllm
module vllm_gpu_runners {
  source = "../../../modules/gcp_mig"

  # global
  env = "dev"
  project_id = "memgpt-428419"
  region = "us-central1"
  zone = "us-central1-c"

  # pool-level config
  pool_name_prefix = "ci-runners-gpu-vllm"
  runner_labels = "gpu,vllm"
  runner_image = "family/gpu-runner-dev"
  machine_type = "g2-standard-24"
  ssh_pubkey = "letta:ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILflk18SwzkU5NS9CPylt3vszYJas365wX7OCTbxPWXw"
  sa_email = "ci-runner-sa-dev@memgpt-428419.iam.gserviceaccount.com"

  # disk
  disk_type = "pd-standard" # required for gpu instances (does not support hyperdisk)
  disk_size_gb = 128

  # repo config
  github_org = "letta-ai"
  github_repo = "letta-cloud"

  final_steps = file("${path.module}/files/vllm-final-steps.sh")

  # auto scaling config
  min_runners = 1
  max_runners = 1
}
