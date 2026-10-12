data "cloudflare_zones" "site" {
  name = var.zone_name
}

resource "cloudflare_dns_record" "site" {
  zone_id = one(data.cloudflare_zones.site.result).id
  name    = var.record_name
  type    = "CNAME"
  content = var.cloudfront_domain_name
  proxied = var.proxied
  ttl     = 1
  comment = "Publishes Block Drop at the site hostname."
}
