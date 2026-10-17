module "site" {
  source = "../../modules/site"

  environment                    = var.environment
  site_domain_name               = var.site_domain_name
  site_certificate_arn           = var.site_certificate_arn
  site_bucket_name               = var.site_bucket_name
  high_score_bucket_name         = var.high_score_bucket_name
  high_score_function_name       = var.high_score_function_name
  high_score_function_role_name  = var.high_score_function_role_name
  github_oidc_provider_arn       = aws_iam_openid_connect_provider.github.arn
  github_actions_subject         = var.github_actions_subject
  github_deploy_role_name        = var.github_deploy_role_name
  github_deploy_role_policy_name = "GitHubDeployRoleDefaultPolicy26C27B56"
  high_scores_role_policy_name   = "HighScoreFunctionServiceRoleDefaultPolicy635C5AB0"

  # Keep CDK-era CloudFront identifiers so the imported distribution does not rewrite origins.
  s3_origin_id         = "BlockDropStackDistributionOrigin139CED3CA"
  lambda_origin_id     = "BlockDropStackDistributionOrigin21CF20209"
  site_oac_name        = "BlockDropStackDistributionOrigin1S3OriginAccessControlF9C59925"
  high_scores_oac_name = "BlockDropStackDistributionOrnctionUrlOriginAccessControl13B0BA06"
  cloudfront_comment   = "Block Drop staging site"
}
