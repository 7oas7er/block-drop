# Requires org RCP to allow Grafana Labs account 008923505280 to
# sts:AssumeRole on shared-block-drop-grafana-cloudwatch-role (see README).
resource "grafana_cloud_provider_aws_account" "block_drop" {
  count    = var.enable_cloudwatch_scrape ? 1 : 0
  provider = grafana.cloud_provider

  depends_on = [
    time_sleep.grafana_iam_propagation,
    aws_iam_role.grafana_cloudwatch,
  ]

  stack_id = data.grafana_cloud_stack.block_drop.id
  role_arn = aws_iam_role.grafana_cloudwatch.arn
  name     = "block-drop"
  regions  = local.scrape_regions
}

# Lambda runs in eu-north-1 — do not scrape us-east-1 for this namespace.
resource "grafana_cloud_provider_aws_cloudwatch_scrape_job" "block_drop" {
  count    = var.enable_cloudwatch_scrape ? 1 : 0
  provider = grafana.cloud_provider

  stack_id                = data.grafana_cloud_stack.block_drop.id
  name                    = "block-drop-cloudwatch"
  aws_account_resource_id = grafana_cloud_provider_aws_account.block_drop[0].resource_id
  enabled                 = true
  export_tags             = true
  regions_subset_override = ["eu-north-1"]

  service {
    name                    = "AWS/Lambda"
    scrape_interval_seconds = 900

    metric {
      name       = "Invocations"
      statistics = ["Sum"]
    }

    metric {
      name       = "Errors"
      statistics = ["Sum"]
    }

    metric {
      name       = "Throttles"
      statistics = ["Sum"]
    }

    metric {
      name       = "Duration"
      statistics = ["Average"]
    }

    tags_to_add_to_metrics = ["Name"]
  }

  static_labels = {
    project = "block-drop"
  }
}

# CloudFront metrics are published in us-east-1 only.
resource "grafana_cloud_provider_aws_cloudwatch_scrape_job" "block_drop_cloudfront" {
  count    = var.enable_cloudwatch_scrape ? 1 : 0
  provider = grafana.cloud_provider

  stack_id                = data.grafana_cloud_stack.block_drop.id
  name                    = "block-drop-cloudwatch-cloudfront"
  aws_account_resource_id = grafana_cloud_provider_aws_account.block_drop[0].resource_id
  enabled                 = true
  export_tags             = true
  regions_subset_override = ["us-east-1"]

  service {
    name                    = "AWS/CloudFront"
    scrape_interval_seconds = 900

    metric {
      name       = "Requests"
      statistics = ["Sum"]
    }

    metric {
      name       = "5xxErrorRate"
      statistics = ["Average"]
    }

    metric {
      name       = "OriginLatency"
      statistics = ["Average"]
    }

    tags_to_add_to_metrics = ["Name"]
  }

  static_labels = {
    project = "block-drop"
  }
}
