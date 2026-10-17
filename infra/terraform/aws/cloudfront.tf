locals {
  # Keep the CDK origin ids so an imported distribution does not rewrite origins.
  s3_origin_id     = "BlockDropStackDistributionOrigin139CED3CA"
  lambda_origin_id = "BlockDropStackDistributionOrigin21CF20209"

  # CloudFront managed policies used by the CDK stack.
  cache_policy_caching_optimized        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  cache_policy_caching_disabled         = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  origin_request_all_viewer_except_host = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  response_headers_security_headers     = "67f7725c-6f97-4210-82d7-5512b31e9d03"
  lambda_function_url_hostname          = trimsuffix(replace(aws_lambda_function_url.high_scores.function_url, "https://", ""), "/")
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "BlockDropStackDistributionOrigin1S3OriginAccessControlF9C59925"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "high_scores" {
  # CDK truncated this name when it created the resource.
  name                              = "BlockDropStackDistributionOrnctionUrlOriginAccessControl13B0BA06"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Block Drop static site"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  http_version        = "http2and3"
  aliases             = [var.site_domain_name]

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  origin {
    domain_name              = local.lambda_function_url_hostname
    origin_id                = local.lambda_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.high_scores.id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id           = local.s3_origin_id
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.cache_policy_caching_optimized
    response_headers_policy_id = local.response_headers_security_headers
  }

  ordered_cache_behavior {
    path_pattern               = "/api/scores"
    target_origin_id           = local.lambda_origin_id
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.cache_policy_caching_disabled
    origin_request_policy_id   = local.origin_request_all_viewer_except_host
    response_headers_policy_id = local.response_headers_security_headers
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.site_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.3_2025"
  }

  tags = {
    Name = "${var.environment}-site-cloudfront-distribution"
  }
}
