output "zone_id" {
  description = "Cloudflare zone that contains the site record."
  value       = one(data.cloudflare_zones.site.result).id
}

output "record_id" {
  description = "Identifier of the site CNAME."
  value       = cloudflare_dns_record.site.id
}

output "record_hostname" {
  description = "Hostname the CNAME publishes."
  value       = cloudflare_dns_record.site.name
}
