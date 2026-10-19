# Parked while Grafana Cloud Provider cannot assume the IAM role
# (401 aws_authentication_error, no AssumeRole in CloudTrail). Set
# enable_cloudwatch_scrape = true once Grafana confirms the link works.
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

resource "grafana_cloud_provider_aws_cloudwatch_scrape_job" "block_drop" {
  count    = var.enable_cloudwatch_scrape ? 1 : 0
  provider = grafana.cloud_provider

  stack_id                = data.grafana_cloud_stack.block_drop.id
  name                    = "block-drop-cloudwatch"
  aws_account_resource_id = grafana_cloud_provider_aws_account.block_drop[0].resource_id
  enabled                 = true
  export_tags             = true

  service {
    name                    = "AWS/Lambda"
    scrape_interval_seconds = 300

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
      statistics = ["Average", "Maximum"]
    }

    tags_to_add_to_metrics = ["Name"]
  }

  service {
    name                    = "AWS/CloudFront"
    scrape_interval_seconds = 300

    metric {
      name       = "Requests"
      statistics = ["Sum"]
    }

    metric {
      name       = "BytesDownloaded"
      statistics = ["Sum"]
    }

    metric {
      name       = "4xxErrorRate"
      statistics = ["Average"]
    }

    metric {
      name       = "5xxErrorRate"
      statistics = ["Average"]
    }

    metric {
      name       = "TotalErrorRate"
      statistics = ["Average"]
    }

    tags_to_add_to_metrics = ["Name"]
  }

  static_labels = {
    project = "block-drop"
  }
}
