variable "prod_cloudfront_domain_name" {
  description = "CloudFront domain name for production (blockdrop.7oas7er.com), such as d111111abcdef8.cloudfront.net."
  type        = string
}

variable "stg_cloudfront_domain_name" {
  description = "CloudFront domain name for staging (blockdrop-stg.7oas7er.com), such as d111111abcdef8.cloudfront.net."
  type        = string
}
