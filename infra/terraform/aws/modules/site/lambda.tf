data "archive_file" "high_scores" {
  type        = "zip"
  output_path = "${path.module}/build/high-scores.zip"

  source {
    content  = file("${path.module}/../../../../lambda/high-scores.js")
    filename = "high-scores.js"
  }
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

  tags = {
    Name = "${var.environment}-high-scores-function"
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
    # Staging still uses CDK-imported statement ids.
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
