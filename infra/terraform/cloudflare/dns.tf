locals {
  zone_id = var.zone_id
}

# App hosts only — do not manage zone apex / www (homepage owns www; apex redirect is platform shared-edge).
resource "cloudflare_dns_record" "blockdrop" {
  zone_id = local.zone_id
  name    = "blockdrop.7oas7er.com"
  type    = "CNAME"
  content = var.prod_cloudfront_domain_name
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "blockdrop_stg" {
  zone_id = local.zone_id
  name    = "blockdrop-stg.7oas7er.com"
  type    = "CNAME"
  content = var.stg_cloudfront_domain_name
  proxied = true
  ttl     = 1
}
