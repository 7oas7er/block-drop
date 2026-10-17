data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

module "site" {
  source = "../../modules/site"

  environment                    = var.environment
  site_domain_name               = var.site_domain_name
  site_certificate_arn           = var.site_certificate_arn
  site_bucket_name               = var.site_bucket_name
  high_score_bucket_name         = var.high_score_bucket_name
  high_score_function_name       = var.high_score_function_name
  high_score_function_role_name  = var.high_score_function_role_name
  github_oidc_provider_arn       = data.aws_iam_openid_connect_provider.github.arn
  github_actions_subject         = var.github_actions_subject
  github_deploy_role_name        = var.github_deploy_role_name
  github_deploy_role_policy_name = "GitHubDeploy"
  high_scores_role_policy_name   = "HighScores"

  s3_origin_id         = "site-s3"
  lambda_origin_id     = "high-scores-lambda"
  site_oac_name        = "block-drop-prod-site-oac"
  high_scores_oac_name = "block-drop-prod-high-scores-oac"
  cloudfront_comment   = "Block Drop production site"
}
