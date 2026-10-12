output "zone_id" {
  description = "Cloudflare zone that contains the site record."
  value       = one(data.cloudflare_zones.site.result).id
}
