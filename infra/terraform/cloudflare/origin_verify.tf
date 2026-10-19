locals {
  zone_id = one(data.cloudflare_zones.site.result).id
}

resource "cloudflare_ruleset" "origin_verify" {
  zone_id     = local.zone_id
  name        = "Block Drop origin verify headers"
  description = "Inject X-Origin-Verify so CloudFront accepts only Cloudflare-proxied traffic."
  kind        = "zone"
  phase       = "http_request_late_transform"

  rules = [
    {
      ref         = "stg_origin_verify"
      description = "Staging Block Drop origin verify"
      expression  = "http.host eq \"blockdrop-stg.7oas7er.com\""
      action      = "rewrite"
      action_parameters = {
        headers = {
          "X-Origin-Verify" = {
            operation = "set"
            value     = var.stg_origin_verify_secret
          }
        }
      }
    },
    {
      ref         = "prod_origin_verify"
      description = "Production Block Drop origin verify"
      expression  = "http.host in {\"blockdrop.7oas7er.com\" \"www.7oas7er.com\" \"7oas7er.com\"}"
      action      = "rewrite"
      action_parameters = {
        headers = {
          "X-Origin-Verify" = {
            operation = "set"
            value     = var.prod_origin_verify_secret
          }
        }
      }
    },
  ]
}

resource "cloudflare_zone_setting" "ssl" {
  zone_id    = local.zone_id
  setting_id = "ssl"
  value      = "strict"
}
