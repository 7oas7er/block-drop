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

resource "cloudflare_dns_record" "www" {
  zone_id = local.zone_id
  name    = "www"
  type    = "CNAME"
  content = cloudflare_dns_record.blockdrop.name
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "root" {
  zone_id = local.zone_id
  name    = "@"
  type    = "CNAME"
  content = cloudflare_dns_record.www.name
  proxied = true
  ttl     = 1
}
