data "grafana_cloud_stack" "block_drop" {
  provider = grafana.cloud
  slug     = var.stack_slug
}

data "aws_iam_policy_document" "grafana_cloudwatch_assume_role" {
  statement {
    sid     = "AllowGrafanaCloudAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.grafana_labs_aws_account_id}:root"]
    }

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [var.grafana_aws_external_id]
    }
  }
}

data "aws_iam_policy_document" "grafana_cloudwatch" {
  statement {
    sid    = "AllowCloudWatchMetricScrape"
    effect = "Allow"
    actions = [
      "tag:GetResources",
      "cloudwatch:GetMetricData",
      "cloudwatch:ListMetrics",
      "apigateway:GET",
      "aps:ListWorkspaces",
      "autoscaling:DescribeAutoScalingGroups",
      "dms:DescribeReplicationInstances",
      "dms:DescribeReplicationTasks",
      "ec2:DescribeTransitGatewayAttachments",
      "ec2:DescribeSpotFleetRequests",
      "shield:ListProtections",
      "storagegateway:ListGateways",
      "storagegateway:ListTagsForResource",
    ]
    resources = ["*"]
  }
}
