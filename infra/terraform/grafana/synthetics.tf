data "grafana_synthetic_monitoring_probes" "main" {
  provider = grafana.sm
}

locals {
  # Prefer EU probes when present; fall back to any published probe map values.
  preferred_probe_names = [
    "Frankfurt",
    "Paris",
    "London",
    "Amsterdam",
  ]

  selected_probe_ids = [
    for name in local.preferred_probe_names : data.grafana_synthetic_monitoring_probes.main.probes[name]
    if contains(keys(data.grafana_synthetic_monitoring_probes.main.probes), name)
  ]

  synthetic_probes = (
    length(local.selected_probe_ids) > 0
    ? slice(local.selected_probe_ids, 0, min(2, length(local.selected_probe_ids)))
    : [values(data.grafana_synthetic_monitoring_probes.main.probes)[0]]
  )
}

resource "grafana_synthetic_monitoring_check" "prod_site" {
  provider = grafana.sm

  job       = "block-drop-prod-site"
  target    = var.prod_site_url
  enabled   = true
  frequency = var.check_frequency_ms
  timeout   = var.check_timeout_ms
  probes    = local.synthetic_probes

  labels = {
    project     = "block-drop"
    environment = "prod"
    kind        = "site"
  }

  settings {
    http {
      method             = "GET"
      fail_if_not_ssl    = true
      valid_status_codes = [200]
    }
  }
}

resource "grafana_synthetic_monitoring_check" "stg_site" {
  provider = grafana.sm

  job       = "block-drop-stg-site"
  target    = var.stg_site_url
  enabled   = true
  frequency = var.check_frequency_ms
  timeout   = var.check_timeout_ms
  probes    = local.synthetic_probes

  labels = {
    project     = "block-drop"
    environment = "stg"
    kind        = "site"
  }

  settings {
    http {
      method             = "GET"
      fail_if_not_ssl    = true
      valid_status_codes = [200]
    }
  }
}

resource "grafana_synthetic_monitoring_check" "prod_scores" {
  provider = grafana.sm

  job       = "block-drop-prod-scores"
  target    = "${var.prod_site_url}/api/scores"
  enabled   = true
  frequency = var.check_frequency_ms
  timeout   = var.check_timeout_ms
  probes    = local.synthetic_probes

  labels = {
    project     = "block-drop"
    environment = "prod"
    kind        = "api"
  }

  settings {
    http {
      method             = "GET"
      fail_if_not_ssl    = true
      valid_status_codes = [200]
    }
  }
}

resource "grafana_synthetic_monitoring_check" "stg_scores" {
  provider = grafana.sm

  job       = "block-drop-stg-scores"
  target    = "${var.stg_site_url}/api/scores"
  enabled   = true
  frequency = var.check_frequency_ms
  timeout   = var.check_timeout_ms
  probes    = local.synthetic_probes

  labels = {
    project     = "block-drop"
    environment = "stg"
    kind        = "api"
  }

  settings {
    http {
      method             = "GET"
      fail_if_not_ssl    = true
      valid_status_codes = [200]
    }
  }
}
