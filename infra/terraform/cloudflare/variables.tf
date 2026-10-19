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
