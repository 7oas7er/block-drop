terraform {
  required_version = ">= 1.5.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "shared-block-drop-terraform-state-bucket"
    key            = "cloudflare/terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "shared-block-drop-terraform-lock-table"
    encrypt        = true
    profile        = "7oas7er"
  }
}

provider "cloudflare" {
  # The provider reads the API token from CLOUDFLARE_API_TOKEN.
}
