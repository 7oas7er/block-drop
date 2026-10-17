data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]

  lifecycle {
    ignore_changes = [thumbprint_list]
  }

  tags = {
    Name = "${var.environment}-github-provider"
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "block-drop-github-deploy"
  description        = "GitHub Actions on main publishes Block Drop and invalidates CloudFront."
  assume_role_policy = data.aws_iam_policy_document.github_deploy_assume_role.json

  tags = {
    Name = "${var.environment}-github-deploy-role"
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "GitHubDeployRoleDefaultPolicy26C27B56"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}

resource "aws_iam_role" "high_scores" {
  name               = var.high_score_function_role_name
  assume_role_policy = data.aws_iam_policy_document.high_scores_assume_role.json

  tags = {
    Name = "${var.environment}-high-scores-function-role"
  }
}

resource "aws_iam_role_policy_attachment" "high_scores_basic" {
  role       = aws_iam_role.high_scores.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "high_scores" {
  name   = "HighScoreFunctionServiceRoleDefaultPolicy635C5AB0"
  role   = aws_iam_role.high_scores.id
  policy = data.aws_iam_policy_document.high_scores.json
}
