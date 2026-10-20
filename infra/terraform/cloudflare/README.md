# Cloudflare — Block Drop (DNS only)

Manages DNS for `blockdrop.7oas7er.com`, `blockdrop-stg.7oas7er.com`, `www`, and apex on zone `7oas7er.com`.

**Zone rulesets** (origin-verify, cache, www/apex redirects, `/api/scores` rate limit, SSL mode) are owned by the platform repo:

https://github.com/7oas7er/platform → `infra/terraform/shared-edge`

Do not recreate competing zone rulesets here (Cloudflare allows one ruleset per phase).

```bash
export AWS_PROFILE=7oas7er
export CLOUDFLARE_API_TOKEN=…   # Zone.DNS Edit + Zone.Read (+ Cache Purge for deploy)
cd infra/terraform/cloudflare
terraform init && terraform apply
```
