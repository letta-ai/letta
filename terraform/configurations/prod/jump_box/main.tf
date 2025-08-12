terraform {
  backend "gcs" {
    bucket = "memgpt-tf"
    prefix = "infra/tfstate/prod/jump_box"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = "memgpt-428419"
  region  = "us-central1"
}

module "jump_box" {
  source = "../../../modules/jump_box"

  project_id = "memgpt-428419"
  env        = "prod"
  region     = "us-central1"
  zone       = "us-central1-a"

  # Use a cheap machine type suitable for a jump box
  machine_type = "e2-micro"

  # Restrict SSH access - consider updating this to your specific IP ranges
  allowed_ssh_sources = ["0.0.0.0/0"]  # TODO: Restrict to specific IPs/VPN

  ssh_username = "letta-posthog"

  ssh_public_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDU0X1I5xXOSUPU5yyWmHzIOg6ZbjoQU6tTUvskS0p4pf+tdWS6ouFn6IA+wc7J3ZFpFN4p7ZX60s3+j2jO5LsJaHacvhyX43C7Jz/kBuExVFReMvWSd/8Sos4rTjsBaKUG/M9t4gw7KQOiMSxqrhKtF4vWAdITHn43+q1xiYU3HaXJwOx1RCnerb2/kfREq7/DUTZJ92qvC0wYwSBnn/eBhuNX7McoFH3DVK3iWYgNiLD70n9XCgKImrjuWzlzx1uf50nZYP+ME6EQVCTkNKPObqnjTNkZIzMUFOP6tMN5V4fgQPLkz19q5VUxuAxpS3OYc3tJqjnPpJWvibJhjhqU9AnroMCXp/D0/7xwPsCNFX3LQshBeSKoJx5x4pMoCWsWnowVImE/iPYRsVla/Q0lomNGqt4hRudfnrYuckRRa+fuNZBH6Vj0AdILBg6w6I5Dy+7Ss5o6+uUs39UMXnYl9LyzQsxnqKPNBwr+heQpH7BH/VEk3DYDQ7EY8ePYSWRLL+X/WmXamhoQFCuRMCD9obv7iA4f2gJz2+nvvVvUZwe/g3sNlq3OLeX5XSJxL36Bx/445Ydwbpd+dGVGlciQnzhjNTHRx0G3bNLY7pogZnv8oX2NKkrjlg7w+sfQ7dJBCF7nmRO9ejPVlbD6Z6vFrvpv3ypBJwUzoRGAE2I3mQ== jump-box-prod"
}
