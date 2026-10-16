data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]

  lifecycle {
    ignore_changes = [thumbprint_list, tags, tags_all]
  }
}

resource "aws_iam_role" "github_deploy" {
  name        = "block-drop-github-deploy"
  description = "GitHub Actions on main publishes Block Drop and invalidates CloudFront."

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sts:AssumeRoleWithWebIdentity",
          "sts:TagSession",
        ]
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = var.github_actions_subject
          }
        }
      },
    ]
  })

  lifecycle {
    ignore_changes = [tags, tags_all]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "GitHubDeployRoleDefaultPolicy26C27B56"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "LocateAndListSiteBucket"
        Effect = "Allow"
        Action = [
          "s3:GetBucketLocation",
          "s3:ListBucket",
        ]
        Resource = aws_s3_bucket.site.arn
      },
      {
        Sid    = "SyncSiteObjects"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        Resource = "${aws_s3_bucket.site.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = "cloudfront:CreateInvalidation"
        Resource = aws_cloudfront_distribution.site.arn
      },
      {
        Sid      = "ReadSiteStackOutputs"
        Effect   = "Allow"
        Action   = "cloudformation:DescribeStacks"
        Resource = "arn:aws:cloudformation:${var.aws_region}:${var.aws_account_id}:stack/${var.cloudformation_stack_name}/*"
      },
    ]
  })
}
