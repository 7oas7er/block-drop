resource "grafana_folder" "block_drop" {
  provider = grafana.stack

  title = "Block Drop"
}

locals {
  block_drop_dashboard = merge(
    jsondecode(file("${path.module}/dashboards/block-drop.json")),
    { id = null },
  )

  # Inject Cloudflare zoneTag default when known (dashboard textbox variable).
  block_drop_dashboard_with_zone = var.cloudflare_zone_tag == null ? local.block_drop_dashboard : merge(
    local.block_drop_dashboard,
    {
      templating = {
        list = [
          for v in local.block_drop_dashboard.templating.list : (
            v.name == "cf_zone" ? merge(v, {
              query   = var.cloudflare_zone_tag
              current = { text = var.cloudflare_zone_tag, value = var.cloudflare_zone_tag }
            }) : v
          )
        ]
      }
    },
  )
}

resource "grafana_dashboard" "block_drop" {
  provider = grafana.stack

  folder      = grafana_folder.block_drop.uid
  config_json = jsonencode(local.block_drop_dashboard_with_zone)
  overwrite   = true
}
