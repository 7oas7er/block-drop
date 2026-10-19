output "grafana_stack_id" {
  description = "Grafana Cloud stack ID used for Cloud Provider resources."
  value       = data.grafana_cloud_stack.block_drop.id
}

output "grafana_stack_url" {
  description = "Grafana Cloud stack URL."
  value       = data.grafana_cloud_stack.block_drop.url
}

output "grafana_cloudwatch_role_arn" {
  description = "IAM role Grafana Cloud assumes for CloudWatch metric scrape."
  value       = aws_iam_role.grafana_cloudwatch.arn
}

output "cloudwatch_scrape_job_name" {
  description = "Name of the CloudWatch scrape job in Grafana Cloud."
  value       = grafana_cloud_provider_aws_cloudwatch_scrape_job.block_drop.name
}

output "synthetic_check_jobs" {
  description = "Synthetic Monitoring job names."
  value = [
    grafana_synthetic_monitoring_check.prod_site.job,
    grafana_synthetic_monitoring_check.stg_site.job,
    grafana_synthetic_monitoring_check.prod_scores.job,
    grafana_synthetic_monitoring_check.stg_scores.job,
  ]
}
