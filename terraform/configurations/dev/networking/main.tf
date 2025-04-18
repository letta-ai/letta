terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/dev/networking"
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


module networking {
    source = "../../../modules/networking"
    env = "dev"
    region = "us-central1"
    vpc_subnet_cidr = "10.1.0.0/16"
}
