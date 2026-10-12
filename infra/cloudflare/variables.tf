variable "zone_name" {
  description = "Cloudflare zone that publishes the site name."
  type        = string
  default     = "7oas7er.com"
}

variable "record_name" {
  description = "Hostname Cloudflare publishes for Block Drop."
  type        = string
  default     = "blockdrop.7oas7er.com"
}

variable "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution, such as d111111abcdef8.cloudfront.net."
  type        = string
}

variable "proxied" {
  description = "Route the hostname through the Cloudflare proxy. Leave this false so clients connect to CloudFront and use the ACM certificate on the distribution."
  type        = bool
  default     = false
}
