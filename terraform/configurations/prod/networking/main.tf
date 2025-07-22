terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/prod/networking"
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
    env = "prod"
    region = "us-central1"
    vpc_subnet_cidr = "10.0.0.0/16"
}
module networking-us-east1 {
    source = "../../../modules/networking"
    env = "prod"
    region = "us-east1"
    vpc_subnet_cidr = "10.0.0.0/16"
}
