locals {
  name_prefix               = "shared-block-drop"
  grafana_cloudwatch_role   = "${local.name_prefix}-grafana-cloudwatch-role"
  grafana_cloudwatch_policy = "${local.name_prefix}-grafana-cloudwatch-policy"
  # Grafana Labs' AWS account that assumes the CloudWatch integration role.
  grafana_labs_aws_account_id = "008923505280"

  scrape_regions = [
    "eu-north-1",
    "us-east-1",
  ]
}
