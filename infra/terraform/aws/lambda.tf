data "archive_file" "high_scores" {
  type        = "zip"
  output_path = "${path.module}/build/high-scores.zip"

  source {
    content  = file("${path.module}/../../lambda/high-scores.js")
    filename = "high-scores.js"
  }
}

resource "aws_iam_role" "high_scores" {
  name = var.high_score_function_role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRole"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      },
    ]
  })

  lifecycle {
    ignore_changes = [tags, tags_all]
  }
}

resource "aws_iam_role_policy_attachment" "high_scores_basic" {
  role       = aws_iam_role.high_scores.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "high_scores" {
  name = "HighScoreFunctionServiceRoleDefaultPolicy635C5AB0"
  role = aws_iam_role.high_scores.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject*",
          "s3:GetBucket*",
          "s3:List*",
        ]
        Resource = [
          aws_s3_bucket.high_scores.arn,
          "${aws_s3_bucket.high_scores.arn}/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectLegalHold",
          "s3:PutObjectRetention",
          "s3:PutObjectTagging",
          "s3:PutObjectVersionTagging",
          "s3:Abort*",
        ]
        Resource = "${aws_s3_bucket.high_scores.arn}/*"
      },
    ]
  })
}

resource "aws_lambda_function" "high_scores" {
  function_name    = var.high_score_function_name
  description      = "Reads and writes the Block Drop high score table."
  role             = aws_iam_role.high_scores.arn
  handler          = "high-scores.handler"
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.high_scores.output_path
  source_code_hash = data.archive_file.high_scores.output_base64sha256
  timeout          = 8
  memory_size      = 128

  environment {
    variables = {
      SCORES_BUCKET = aws_s3_bucket.high_scores.bucket
      SCORES_KEY    = "high-scores.json"
    }
  }

  depends_on = [
    aws_iam_role_policy.high_scores,
    aws_iam_role_policy_attachment.high_scores_basic,
  ]

  lifecycle {
    ignore_changes = [tags, tags_all]
  }
}

resource "aws_lambda_function_url" "high_scores" {
  function_name      = aws_lambda_function.high_scores.function_name
  authorization_type = "AWS_IAM"
}

resource "aws_lambda_permission" "high_scores_invoke_url_from_cloudfront" {
  statement_id           = "AllowCloudFrontInvokeFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.high_scores.function_name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = aws_cloudfront_distribution.site.arn
  function_url_auth_type = "AWS_IAM"

  lifecycle {
    # CDK generated its own statement ids; keep the imported values.
    ignore_changes = [statement_id]
  }
}

resource "aws_lambda_permission" "high_scores_invoke_from_cloudfront" {
  statement_id             = "AllowCloudFrontInvokeFunction"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.high_scores.function_name
  principal                = "cloudfront.amazonaws.com"
  source_arn               = aws_cloudfront_distribution.site.arn
  invoked_via_function_url = true

  lifecycle {
    ignore_changes = [statement_id]
  }
}
