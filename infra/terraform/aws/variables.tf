variable "environment" {
  description = "Short environment name used in resource tags (for example stg or prod)."
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
  default     = "blockdrop.7oas7er.com"
}

variable "site_certificate_arn" {
  description = "ACM certificate in us-east-1 used by CloudFront."
  type        = string
  default     = "arn:aws:acm:us-east-1:877710816497:certificate/5662db01-9020-4cc4-957a-91876b13e427"
}

variable "site_bucket_name" {
  description = "Existing private site bucket name (CDK-generated)."
  type        = string
  default     = "blockdropstack-sitebucket397a1860-fldg9ahi4wil"
}

variable "high_score_bucket_name" {
  description = "Existing private high-score bucket name (CDK-generated). Fill before import."
  type        = string
}

variable "high_score_function_name" {
  description = "Existing high-score Lambda function name. Fill before import."
  type        = string
}

variable "high_score_function_role_name" {
  description = "Existing IAM role name for the high-score Lambda. Fill before import."
  type        = string
}

variable "github_actions_subject" {
  description = "Immutable GitHub Actions OIDC subject allowed to assume the deploy role."
  type        = string
  default     = "repo:7oas7er@2952810/block-drop@1407099747:ref:refs/heads/main"
}
