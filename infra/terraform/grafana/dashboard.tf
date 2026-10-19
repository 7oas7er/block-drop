resource "grafana_folder" "block_drop" {
  provider = grafana.stack

  title = "Block Drop"
}

resource "grafana_dashboard" "block_drop" {
  provider = grafana.stack

  folder = grafana_folder.block_drop.uid
  config_json = jsonencode(merge(
    jsondecode(file("${path.module}/dashboards/block-drop.json")),
    {
      id = null
    }
  ))
  overwrite = true
}
