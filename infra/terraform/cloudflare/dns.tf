data "cloudflare_zones" "site" {
  name = "7oas7er.com"
}

resource "cloudflare_dns_record" "blockdrop" {
  zone_id = one(data.cloudflare_zones.site.result).id
  name    = "blockdrop.7oas7er.com"
  type    = "CNAME"
  content = var.prod_cloudfront_domain_name
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "blockdrop_stg" {
  zone_id = one(data.cloudflare_zones.site.result).id
  name    = "blockdrop-stg.7oas7er.com"
  type    = "CNAME"
  content = var.stg_cloudfront_domain_name
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "www" {
  zone_id = one(data.cloudflare_zones.site.result).id
  name    = "www"
  type    = "CNAME"
  content = cloudflare_dns_record.blockdrop.name
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "root" {
  zone_id = one(data.cloudflare_zones.site.result).id
  name    = "@"
  type    = "CNAME"
  content = cloudflare_dns_record.www.name
  proxied = true
  ttl     = 1
}
