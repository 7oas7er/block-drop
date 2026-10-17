variable "environment" {
  description = "Short environment name used in resource names and tags."
  type        = string
  default     = "stg"
}

variable "aws_region" {
  description = "Region of the Block Drop resources (Lambda, S3)."
  type        = string
  default     = "eu-north-1"
}

variable "aws_profile" {
  description = "Shared credentials / config profile for the AWS provider."
  type        = string
  default     = "7oas7er"
}

variable "site_domain_name" {
  description = "Custom domain attached to the CloudFront distribution."
  type        = string
  default     = "blockdrop-stg.7oas7er.com"
}

variable "site_certificate_arn" {
  description = "ACM certificate in us-east-1 for the staging hostname."
  type        = string
}

variable "github_actions_subject" {
  description = "Immutable GitHub Actions OIDC subject allowed to assume the deploy role."
  type        = string
  default     = "repo:7oas7er@2952810/block-drop@1407099747:ref:refs/heads/main"
}
