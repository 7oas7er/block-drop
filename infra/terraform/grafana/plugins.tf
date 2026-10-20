# Grafana Cloud does not ship these catalog plugins by default. Without an
# install, a provisioned data source of that type is invisible in the UI
# ("No data sources found" on dashboard variables).
resource "grafana_cloud_plugin_installation" "infinity" {
  count    = local.enable_cloudflare_edge ? 1 : 0
  provider = grafana.cloud

  stack_slug = var.stack_slug
  slug       = "yesoreyeram-infinity-datasource"
  version    = "latest"
}

resource "grafana_cloud_plugin_installation" "github" {
  count    = local.enable_github_ci ? 1 : 0
  provider = grafana.cloud

  stack_slug = var.stack_slug
  slug       = "grafana-github-datasource"
  version    = "latest"
}
