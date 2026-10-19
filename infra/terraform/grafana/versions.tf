terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    grafana = {
      source  = "grafana/grafana"
      version = "~> 4.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.13"
    }
  }

  backend "s3" {
    bucket         = "shared-block-drop-terraform-state-bucket"
    key            = "grafana/terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "shared-block-drop-terraform-lock-table"
    encrypt        = true
    profile        = "7oas7er"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

# Cloud stack lookup + Cloud Provider scrape jobs.
provider "grafana" {
  alias                       = "cloud"
  cloud_access_policy_token   = var.cloud_access_policy_token
  cloud_provider_url          = var.cloud_provider_url
  cloud_provider_access_token = var.cloud_provider_access_token
}

# Synthetic Monitoring checks.
provider "grafana" {
  alias           = "sm"
  sm_url          = var.sm_url
  sm_access_token = var.sm_access_token
}
