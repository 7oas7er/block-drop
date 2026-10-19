resource "grafana_cloud_provider_aws_account" "block_drop" {
  provider = grafana.cloud

  depends_on = [time_sleep.grafana_iam_propagation]

  stack_id = data.grafana_cloud_stack.block_drop.id
  role_arn = aws_iam_role.grafana_cloudwatch.arn
  name     = "block-drop"
  regions  = local.scrape_regions
}

resource "grafana_cloud_provider_aws_cloudwatch_scrape_job" "block_drop" {
  provider = grafana.cloud

  stack_id                = data.grafana_cloud_stack.block_drop.id
  name                    = "block-drop-cloudwatch"
  aws_account_resource_id = grafana_cloud_provider_aws_account.block_drop.resource_id
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
