# Cloudflare Free: one rate-limit rule, path/Verified Bot fields only, 10s periods.
# Protect /api/scores (high-score GET/POST) from cheap floods; static assets stay unlimited.
resource "cloudflare_ruleset" "rate_limit" {
  zone_id     = local.zone_id
  name        = "Block Drop rate limiting"
  description = "IP rate limit for Block Drop /api/scores (Cloudflare Free constraints)."
  kind        = "zone"
  phase       = "http_ratelimit"

  rules = [
    {
      ref         = "block_drop_api_scores_ip"
      description = "Rate limit /api/scores by IP (Free: 10s window)"
      # Free plan cannot use http.host in rate-limit expressions; path-only is zone-wide.
      expression = "(http.request.uri.path eq \"/api/scores\")"
      action     = "block"
      ratelimit = {
        characteristics     = ["cf.colo.id", "ip.src"]
        period              = var.api_rate_limit_period_seconds
        requests_per_period = var.api_rate_limit_requests_per_period
        mitigation_timeout  = var.api_rate_limit_mitigation_timeout_seconds
      }
    },
  ]
}
