terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/dev/ci_runners"
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

module "ci_runners" {
  source = "../../../modules/ci_runners"

  # global
  env = "dev"
  project_id = "memgpt-428419"
  region = "us-central1"
  zone = "us-central1-a"

  # instance config
  runner_image = "family/ci-runner-dev"
  machine_type = "c4a-standard-4"
  ssh_pubkey = "letta:ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILflk18SwzkU5NS9CPylt3vszYJas365wX7OCTbxPWXw"

  # disk
  disk_type = "hyperdisk-balanced" # required for c4a instances (high performance but cheaper cause ARM)
  disk_size_gb = 128

  # repo config
  github_org = "letta-ai"
  github_repo = "letta-cloud"

  # auto scaling config
  min_runners = 1
  max_runners = 24
}
