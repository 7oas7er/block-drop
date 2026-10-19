# Adopt the Lambda log group created automatically before Terraform managed retention.
import {
  to = module.site.aws_cloudwatch_log_group.high_scores
  id = "/aws/lambda/stg-block-drop-high-scores-function"
}
