output "github_deploy_role_arn" {
  description = "Store this in the GitHub repository variable AWS_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.github_deploy.arn
}

output "deploy_region" {
  description = "Store this in the GitHub repository variable AWS_REGION."
  value       = var.aws_region
}

output "site_url" {
  description = "HTTPS URL for Block Drop."
  value       = "https://${var.site_domain_name}"
}

output "bucket_name" {
  description = "Store this in the GitHub repository variable AWS_SITE_BUCKET."
  value       = aws_s3_bucket.site.bucket
}

output "high_score_bucket_name" {
  description = "Private bucket that stores the high score table."
  value       = aws_s3_bucket.high_scores.bucket
}

output "distribution_id" {
  description = "Store this in the GitHub repository variable AWS_DISTRIBUTION_ID."
  value       = aws_cloudfront_distribution.site.id
}

output "distribution_domain_name" {
  description = "CloudFront domain name, used by the Cloudflare CNAME."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "high_score_function_name" {
  description = "Lambda function that serves /api/scores."
  value       = aws_lambda_function.high_scores.function_name
}

output "high_score_function_url" {
  description = "Function URL origin behind CloudFront."
  value       = aws_lambda_function_url.high_scores.function_url
}
