terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/prod/ci_runners"
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
  min_runners = 24
  max_runners = 32
}

# hitting CPU quota on GCP bc all runners were sized to support cypress, so trying with smaller runners
module small_runners {
  source = "../../../modules/gcp_mig"

  # global
  env = "dev"
  project_id = "memgpt-428419"
  region = "us-central1"
  zone = "us-central1-a"

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
  min_runners = 0
  max_runners = 0
}