variable "environment" {
  description = "Short environment name used in resource tags."
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

variable "site_bucket_name" {
  description = "Private S3 bucket that stores the production site files."
  type        = string
  default     = "block-drop-prod-site-877710816497"
}

variable "high_score_bucket_name" {
  description = "Private S3 bucket that stores the production high score table."
  type        = string
  default     = "block-drop-prod-high-scores-877710816497"
}

variable "high_score_function_name" {
  description = "Lambda function name for /api/scores."
  type        = string
  default     = "block-drop-prod-high-scores"
}

variable "high_score_function_role_name" {
  description = "IAM role name for the high-score Lambda."
  type        = string
  default     = "block-drop-prod-high-scores"
}

variable "github_actions_subject" {
  description = "Immutable GitHub Actions OIDC subject allowed to assume the prod deploy role."
  type        = string
  default     = "repo:7oas7er@2952810/block-drop@1407099747:ref:refs/heads/main"
}

variable "github_deploy_role_name" {
  description = "IAM role name assumed by GitHub Actions for production publishes."
  type        = string
  default     = "block-drop-prod-github-deploy"
}
