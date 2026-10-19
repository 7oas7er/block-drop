variable "prod_cloudfront_domain_name" {
  description = "CloudFront domain name for production (blockdrop.7oas7er.com), such as d111111abcdef8.cloudfront.net."
  type        = string
}

variable "stg_cloudfront_domain_name" {
  description = "CloudFront domain name for staging (blockdrop-stg.7oas7er.com), such as d111111abcdef8.cloudfront.net."
  type        = string
}

variable "stg_origin_verify_secret" {
  description = "Secret Cloudflare sets as X-Origin-Verify for staging; must match envs/stg origin_verify_secret."
  type        = string
  sensitive   = true
}

variable "prod_origin_verify_secret" {
  description = "Secret Cloudflare sets as X-Origin-Verify for production; must match envs/prod origin_verify_secret."
  type        = string
  sensitive   = true
}

# Cloudflare Free only allows a 10s counting period and 10s mitigation timeout.
# On Pro+, you can raise these (supported values: 10, 15, 20, 30, …).
variable "api_rate_limit_period_seconds" {
  description = "Counting window in seconds for /api/scores rate limiting (Free plan: must be 10)."
  type        = number
  default     = 10

  validation {
    condition     = contains([10, 15, 20, 30, 40, 45, 60, 90, 120, 180, 240, 300, 480, 600, 900, 1200, 1800, 2400, 3600], var.api_rate_limit_period_seconds)
    error_message = "api_rate_limit_period_seconds must be a Cloudflare-supported counting period."
  }
}

variable "api_rate_limit_requests_per_period" {
  description = "Max requests per IP (per colo) to /api/scores within the counting period before blocking."
  type        = number
  default     = 20

  validation {
    condition     = var.api_rate_limit_requests_per_period >= 1 && var.api_rate_limit_requests_per_period <= 1000000
    error_message = "api_rate_limit_requests_per_period must be between 1 and 1000000."
  }
}

variable "api_rate_limit_mitigation_timeout_seconds" {
  description = "How long to keep blocking after the threshold is hit (Free plan: must be 10)."
  type        = number
  default     = 10

  validation {
    condition     = contains([10, 15, 20, 30, 40, 45, 60, 90, 120, 180, 240, 300, 480, 600, 900, 1200, 1800, 2400, 3600, 65535, 86400], var.api_rate_limit_mitigation_timeout_seconds)
    error_message = "api_rate_limit_mitigation_timeout_seconds must be a Cloudflare-supported mitigation period."
  }
}
