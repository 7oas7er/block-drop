#!/usr/bin/env bash
# Discover CDK physical ids and import them into this Terraform state.
# Usage:
#   cp terraform.tfvars.example terraform.tfvars   # fill known values
#   ./import-commands.sh discover                  # print ids to paste into tfvars
#   ./import-commands.sh import                    # run terraform import

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PROFILE="${AWS_PROFILE:-7oas7er}"
REGION="${AWS_REGION:-eu-north-1}"
STACK="${CLOUDFORMATION_STACK_NAME:-BlockDropStack}"

aws_cli() {
  aws --profile "$PROFILE" --region "$REGION" "$@"
}

discover() {
  echo "Reading CloudFormation stack ${STACK} in ${REGION} (profile ${PROFILE})..."

  # Avoid mapfile / Bash 4 features so this runs on macOS /bin/bash 3.2.
  local site_bucket="" high_bucket="" dist_id="" fn_name="" fn_role=""
  local logical type physical
  local s3_oac_name="BlockDropStackDistributionOrigin1S3OriginAccessControlF9C59925"
  local lambda_oac_name="BlockDropStackDistributionOrnctionUrlOriginAccessControl13B0BA06"

  while IFS=$'\t' read -r logical type physical; do
    case "$logical" in
      SiteBucket*) site_bucket="$physical" ;;
      HighScoreBucket9AA5F4D8) high_bucket="$physical" ;;
      Distribution830FAC52) dist_id="$physical" ;;
      HighScoreFunctionD50DBF7C) fn_name="$physical" ;;
      HighScoreFunctionServiceRoleA0EDDA67) fn_role="$physical" ;;
    esac
  done < <(aws_cli cloudformation list-stack-resources \
    --stack-name "$STACK" \
    --query "StackResourceSummaries[].[LogicalResourceId,ResourceType,PhysicalResourceId]" \
    --output text)

  local s3_oac_id lambda_oac_id
  s3_oac_id=$(aws --profile "$PROFILE" cloudfront list-origin-access-controls \
    --query "OriginAccessControlList.Items[?Name=='${s3_oac_name}'].Id | [0]" \
    --output text)
  lambda_oac_id=$(aws --profile "$PROFILE" cloudfront list-origin-access-controls \
    --query "OriginAccessControlList.Items[?Name=='${lambda_oac_name}'].Id | [0]" \
    --output text)

  cat <<EOF

# Paste into terraform.tfvars
site_bucket_name                = "${site_bucket}"
high_score_bucket_name          = "${high_bucket}"
distribution_id                 = "${dist_id}"
s3_origin_access_control_id     = "${s3_oac_id}"
lambda_origin_access_control_id = "${lambda_oac_id}"
high_score_function_name        = "${fn_name}"
high_score_function_role_name   = "${fn_role}"
EOF
}

require_tfvars() {
  if [[ ! -f terraform.tfvars ]]; then
    echo "Create terraform.tfvars first (copy terraform.tfvars.example and fill values)." >&2
    exit 1
  fi
}

tfvar() {
  # shellcheck disable=SC2016
  awk -F'=' -v key="$1" '
    $1 ~ "^[[:space:]]*"key"[[:space:]]*$" {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
      gsub(/^"|"$/, "", $2)
      print $2
      exit
    }
  ' terraform.tfvars
}

run_import() {
  require_tfvars

  local site_bucket high_bucket dist_id s3_oac lambda_oac fn_name fn_role account
  site_bucket=$(tfvar site_bucket_name)
  high_bucket=$(tfvar high_score_bucket_name)
  dist_id=$(tfvar distribution_id)
  s3_oac=$(tfvar s3_origin_access_control_id)
  lambda_oac=$(tfvar lambda_origin_access_control_id)
  fn_name=$(tfvar high_score_function_name)
  fn_role=$(tfvar high_score_function_role_name)
  account=$(tfvar aws_account_id)
  [[ -n "$account" ]] || account="877710816497"

  if [[ -z "$site_bucket" || -z "$high_bucket" || -z "$dist_id" || -z "$s3_oac" || -z "$lambda_oac" || -z "$fn_name" || -z "$fn_role" ]]; then
    echo "terraform.tfvars is missing one or more import ids. Run: $0 discover" >&2
    exit 1
  fi

  terraform init

  terraform import aws_s3_bucket.site "$site_bucket"
  terraform import aws_s3_bucket_ownership_controls.site "$site_bucket"
  terraform import aws_s3_bucket_public_access_block.site "$site_bucket"
  terraform import aws_s3_bucket_server_side_encryption_configuration.site "$site_bucket"
  terraform import aws_s3_bucket_policy.site "$site_bucket"

  terraform import aws_s3_bucket.high_scores "$high_bucket"
  terraform import aws_s3_bucket_ownership_controls.high_scores "$high_bucket"
  terraform import aws_s3_bucket_public_access_block.high_scores "$high_bucket"
  terraform import aws_s3_bucket_server_side_encryption_configuration.high_scores "$high_bucket"
  terraform import aws_s3_bucket_policy.high_scores "$high_bucket"

  terraform import aws_cloudfront_origin_access_control.site "$s3_oac"
  terraform import aws_cloudfront_origin_access_control.high_scores "$lambda_oac"
  terraform import aws_cloudfront_distribution.site "$dist_id"

  terraform import aws_iam_role.high_scores "$fn_role"
  terraform import aws_iam_role_policy_attachment.high_scores_basic "$fn_role/arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  terraform import aws_iam_role_policy.high_scores "$fn_role:HighScoreFunctionServiceRoleDefaultPolicy635C5AB0"
  terraform import aws_lambda_function.high_scores "$fn_name"
  terraform import aws_lambda_function_url.high_scores "$fn_name"

  local url_stmt fn_stmt
  url_stmt=$(aws_cli lambda get-policy --function-name "$fn_name" --query 'Policy' --output text \
    | python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); print(next(s["Sid"] for s in p["Statement"] if s["Action"]=="lambda:InvokeFunctionUrl"))')
  fn_stmt=$(aws_cli lambda get-policy --function-name "$fn_name" --query 'Policy' --output text \
    | python3 -c 'import json,sys; p=json.loads(sys.stdin.read()); print(next(s["Sid"] for s in p["Statement"] if s["Action"]=="lambda:InvokeFunction"))')

  terraform import aws_lambda_permission.high_scores_invoke_url_from_cloudfront "${fn_name}/${url_stmt}"
  terraform import aws_lambda_permission.high_scores_invoke_from_cloudfront "${fn_name}/${fn_stmt}"

  terraform import aws_iam_openid_connect_provider.github "arn:aws:iam::${account}:oidc-provider/token.actions.githubusercontent.com"
  terraform import aws_iam_role.github_deploy block-drop-github-deploy
  terraform import aws_iam_role_policy.github_deploy "block-drop-github-deploy:GitHubDeployRoleDefaultPolicy26C27B56"

  echo
  echo "Import finished. Run: terraform plan"
}

case "${1:-}" in
  discover) discover ;;
  import) run_import ;;
  *)
    echo "Usage: $0 discover|import" >&2
    exit 1
    ;;
esac
