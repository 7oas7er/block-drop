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

output "grafana_aws_external_id" {
  description = "External ID currently required by the CloudWatch IAM trust policy."
  value = coalesce(
    var.grafana_aws_external_id,
    tostring(data.grafana_cloud_stack.block_drop.prometheus_user_id),
  )
}

output "cloudwatch_scrape_job_name" {
  description = "Name of the CloudWatch scrape job in Grafana Cloud (null while enable_cloudwatch_scrape is false)."
  value       = try(grafana_cloud_provider_aws_cloudwatch_scrape_job.block_drop[0].name, null)
}

output "enable_cloudwatch_scrape" {
  description = "Whether Cloud Provider AWS account + scrape job resources are managed."
  value       = var.enable_cloudwatch_scrape
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

output "block_drop_dashboard_url" {
  description = "URL of the Block Drop overview dashboard."
  value       = grafana_dashboard.block_drop.url
}

output "block_drop_folder_uid" {
  description = "UID of the Block Drop Grafana folder."
  value       = grafana_folder.block_drop.uid
}
