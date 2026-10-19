# Block Drop — Grafana Cloud observability

Observability for Block Drop lives in **Grafana Cloud Free** (synthetics + CloudWatch metric scrape). Cloudflare stays DNS/edge only.

**CloudWatch scrape is parked** (`enable_cloudwatch_scrape = false`) until Grafana can assume the IAM role. Synthetics and the IAM role still apply. Flip the flag to `true` after support confirms linking works.

## What this root manages

| Resource | Purpose |
|----------|---------|
| `shared-block-drop-grafana-cloudwatch-role` | IAM role Grafana Labs assumes to read CloudWatch |
| `grafana_cloud_provider_aws_account` | Links the AWS account to the Grafana stack (gated) |
| `grafana_cloud_provider_aws_cloudwatch_scrape_job` | Scrapes Lambda + CloudFront metrics (gated) |
| Synthetic HTTP checks | Prod/stg site + `/api/scores` (prod: ≤2 EU probes @ 5m; stg: 1 probe @ 15m) |
| Folder + dashboard `Block Drop` | Synthetics + (future) CloudWatch on one board |

State key: `grafana/terraform.tfstate` in `shared-block-drop-terraform-state-bucket`.

## One-time Grafana setup

1. Create a [Grafana Cloud Free](https://grafana.com/products/cloud/) account and stack.
2. Create a Cloud access policy token with `stacks:read`, `stack-service-accounts:write` (for dashboards), and `integration-management:read|write` for Cloud Provider (or a separate token).
3. In the stack: **Synthetics → Config** — create an SM access token (`sm_access_token`).
4. Copy `terraform.tfvars.example` → `terraform.tfvars` and fill values (never commit `terraform.tfvars`).
   - IAM trust External ID defaults to the stack `prometheus_user_id`. If account create fails with `aws_authentication_error` and CloudTrail shows no `AssumeRole`, copy the External ID from **Cloud Provider → AWS → Add account** into `grafana_aws_external_id`.
   - Cloud Provider API URL comes from the stack `cloud_provider_url` automatically (do not invent it from `region_slug`; they can differ).
   - Terraform creates a stack service account `block-drop-terraform` to publish the Block Drop dashboard.

## Apply

```bash
cd infra/terraform/grafana
cp terraform.tfvars.example terraform.tfvars   # first time
terraform init
terraform plan
terraform apply
```

AWS profile: `7oas7er`. Tokens may also be supplied via `GRAFANA_*` env vars where the provider supports them.

## Notes

- Set `enable_cloudwatch_scrape = true` in `terraform.tfvars` to create the Cloud Provider AWS account + scrape job.
- CloudWatch scrape covers `eu-north-1` and `us-east-1` (CloudFront metrics).
- Tagged AWS resources (`Name` tags on Block Drop) improve metric discovery.
- Shipping CloudWatch **Logs** into Grafana Cloud Logs is a follow-up (not required for the first scrape + synthetics setup).
