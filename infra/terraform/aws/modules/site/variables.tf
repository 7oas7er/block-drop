variable "environment" {
  description = "Short environment name used in resource names and tags (for example stg or prod)."
  type        = string
}

variable "site_domain_name" {
  description = "Custom domain attached to the CloudFront distribution."
  type        = string
}

variable "site_certificate_arn" {
  description = "ACM certificate in us-east-1 used by CloudFront."
  type        = string
}

variable "github_oidc_provider_arn" {
  description = "ARN of the account GitHub Actions OIDC provider."
  type        = string
}

variable "github_actions_subject" {
  description = "Immutable GitHub Actions OIDC subject allowed to assume the deploy role."
  type        = string
}
