resource "grafana_folder" "block_drop" {
  provider = grafana.stack

  title = "Block Drop"
}

locals {
  block_drop_dashboard_files = {
    prod = "${path.module}/dashboards/block-drop-prod.json"
    stg  = "${path.module}/dashboards/block-drop-stg.json"
  }

  block_drop_dashboards = {
    for env, path in local.block_drop_dashboard_files :
    env => merge(jsondecode(file(path)), { id = null })
  }

  # Inject CF zoneTag + GitHub owner/repo into dashboard textbox variables.
  block_drop_dashboards_with_zone = {
    for env, dash in local.block_drop_dashboards :
    env => merge(
      dash,
      {
        templating = {
          list = [
            for v in dash.templating.list : (
              v.name == "cf_zone" && var.cloudflare_zone_tag != null ? merge(v, {
                query   = var.cloudflare_zone_tag
                current = { text = var.cloudflare_zone_tag, value = var.cloudflare_zone_tag }
                }) : v.name == "gh_owner" ? merge(v, {
                query   = var.github_owner
                current = { text = var.github_owner, value = var.github_owner }
                }) : v.name == "gh_repo" ? merge(v, {
                query   = var.github_repository
                current = { text = var.github_repository, value = var.github_repository }
              }) : v
            )
          ]
        }
      },
    )
  }
}

resource "grafana_dashboard" "block_drop_env" {
  for_each = local.block_drop_dashboards_with_zone

  provider = grafana.stack

  folder      = grafana_folder.block_drop.uid
  config_json = jsonencode(each.value)
  overwrite   = true
}
