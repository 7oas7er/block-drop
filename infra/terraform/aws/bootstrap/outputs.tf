output "state_bucket_name" {
  description = "S3 bucket used by Terraform backends."
  value       = aws_s3_bucket.terraform_state.bucket
}

output "lock_table_name" {
  description = "Legacy DynamoDB lock table (unused; backends use S3 use_lockfile)."
  value       = aws_dynamodb_table.terraform_lock.name
}

output "state_bucket_arn" {
  description = "ARN of the Terraform state bucket."
  value       = aws_s3_bucket.terraform_state.arn
}
