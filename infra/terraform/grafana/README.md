# Block Drop — Grafana Cloud observability

Observability for Block Drop lives in **Grafana Cloud Free** (synthetics + CloudWatch metric scrape). Cloudflare stays DNS/edge only.

## What this root manages

| Resource | Purpose |
|----------|---------|
| `shared-block-drop-grafana-cloudwatch-role` | IAM role Grafana Labs assumes to read CloudWatch |
| `grafana_cloud_provider_aws_account` | Links the AWS account to the Grafana stack |
| `grafana_cloud_provider_aws_cloudwatch_scrape_job` | Scrapes Lambda + CloudFront metrics |
| Synthetic HTTP checks | Prod/stg site + `/api/scores` |

State key: `grafana/terraform.tfstate` in `shared-block-drop-terraform-state-bucket`.

## One-time Grafana setup

1. Create a [Grafana Cloud Free](https://grafana.com/products/cloud/) account and stack.
2. Create a Cloud access policy token with `stacks:read` (and `integration-management:read|write` for Cloud Provider, or a separate token).
3. In the stack: **Synthetics → Config** — copy API URL and create an SM access token.
4. In **Observability → Cloud Provider → AWS**, note the **External ID** used when linking an account (or Prometheus details).
5. Copy `terraform.tfvars.example` → `terraform.tfvars` and fill values (never commit `terraform.tfvars`).

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

- CloudWatch scrape covers `eu-north-1` and `us-east-1` (CloudFront metrics).
- Tagged AWS resources (`Name` tags on Block Drop) improve metric discovery.
- Shipping CloudWatch **Logs** into Grafana Cloud Logs is a follow-up (not required for the first scrape + synthetics setup).
