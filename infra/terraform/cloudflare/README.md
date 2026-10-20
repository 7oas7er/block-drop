# Cloudflare (Block Drop) — DNS only

Manages CNAMEs for `blockdrop` / `blockdrop-stg` (and www/apex → blockdrop).

**Zone rulesets** (origin-verify, cache, redirects, `/api/scores` rate limit, SSL mode) live in the platform repo: `infra/terraform/shared-edge`. Do not reintroduce them here.

```bash
export AWS_PROFILE=7oas7er
export CLOUDFLARE_API_TOKEN=…   # Zone DNS Edit (+ Read)
terraform init
terraform plan
terraform apply
```

Origin-verify secret rotation: AWS side stays in this repo; Cloudflare inject side is platform `shared-edge` — see [`../docs/origin-verify-secret-rotation.md`](../docs/origin-verify-secret-rotation.md).
