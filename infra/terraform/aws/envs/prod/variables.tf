variable "environment" {
  description = "Short environment name used in resource names and tags."
  type        = string
  default     = "prod"
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
  default     = "blockdrop.7oas7er.com"
}

variable "site_certificate_arn" {
  description = "ACM certificate in us-east-1 for the production hostname."
  type        = string
  default     = "arn:aws:acm:us-east-1:877710816497:certificate/5662db01-9020-4cc4-957a-91876b13e427"
}

variable "github_actions_subject" {
  description = "Immutable GitHub Actions OIDC subject allowed to assume the prod deploy role."
  type        = string
  default     = "repo:7oas7er@2952810/block-drop@1407099747:ref:refs/heads/main"
}

variable "origin_verify_secret" {
  description = "Shared secret Cloudflare injects as X-Origin-Verify for production; must match Cloudflare prod_origin_verify_secret."
  type        = string
  sensitive   = true
}
