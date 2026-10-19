# Align Cloudflare edge TTL with origin Cache-Control (deploy sets max-age=60).
# Without this, Cloudflare's default static-extension caching can hold JS/CSS ~4h.
resource "cloudflare_ruleset" "cache" {
  zone_id     = local.zone_id
  name        = "Block Drop cache settings"
  description = "Respect origin Cache-Control for Block Drop hosts; bypass /api/scores."
  kind        = "zone"
  phase       = "http_request_cache_settings"

  rules = [
    {
      ref         = "block_drop_api_bypass"
      description = "Do not cache Block Drop high-score API"
      expression  = "(http.host in {\"blockdrop.7oas7er.com\" \"blockdrop-stg.7oas7er.com\" \"www.7oas7er.com\" \"7oas7er.com\"} and starts_with(http.request.uri.path, \"/api/\"))"
      action      = "set_cache_settings"
      action_parameters = {
        cache = false
      }
    },
    {
      ref         = "block_drop_respect_origin"
      description = "Respect origin Cache-Control for Block Drop static assets"
      expression  = "(http.host in {\"blockdrop.7oas7er.com\" \"blockdrop-stg.7oas7er.com\" \"www.7oas7er.com\" \"7oas7er.com\"})"
      action      = "set_cache_settings"
      action_parameters = {
        cache = true
        edge_ttl = {
          mode = "respect_origin"
        }
        browser_ttl = {
          mode = "respect_origin"
        }
      }
    },
  ]
}
