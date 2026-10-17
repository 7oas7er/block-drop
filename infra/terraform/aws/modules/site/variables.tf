variable "environment" {
  description = "Short environment name used in resource tags (for example stg or prod)."
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

variable "site_bucket_name" {
  description = "Private S3 bucket that stores the static site files."
  type        = string
}

variable "high_score_bucket_name" {
  description = "Private S3 bucket that stores the high score table."
  type        = string
}

variable "high_score_function_name" {
  description = "Lambda function name for /api/scores."
  type        = string
}

variable "high_score_function_role_name" {
  description = "IAM role name for the high-score Lambda."
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

variable "github_deploy_role_name" {
  description = "IAM role name assumed by GitHub Actions to publish the site."
  type        = string
}

variable "github_deploy_role_policy_name" {
  description = "Inline policy name on the GitHub deploy role."
  type        = string
  default     = "GitHubDeploy"
}

variable "high_scores_role_policy_name" {
  description = "Inline policy name on the high-score Lambda role."
  type        = string
  default     = "HighScores"
}

variable "s3_origin_id" {
  description = "CloudFront origin id for the site bucket."
  type        = string
}

variable "lambda_origin_id" {
  description = "CloudFront origin id for the high-score function URL."
  type        = string
}

variable "site_oac_name" {
  description = "Name of the CloudFront OAC for the site bucket."
  type        = string
}

variable "high_scores_oac_name" {
  description = "Name of the CloudFront OAC for the high-score function URL."
  type        = string
}

variable "cloudfront_comment" {
  description = "Comment on the CloudFront distribution."
  type        = string
  default     = "Block Drop static site"
}
