# High-scores Lambda

Runtime: Node.js 22 (`nodejs22.x`), arm64. Handler: `high-scores.handler`.

Node.js 18+ Lambda runtimes do **not** include the AWS SDK. This package vendors
`@aws-sdk/client-s3` into the deployment zip via Terraform `archive_file`.

## API (`POST /api/scores`)

| Body | Result |
|------|--------|
| `{"op":"ticket"}` | Mint a short-lived HMAC play ticket (`ticket`, `expiresAt`). |
| `{"name","score","ticket"}` | Verify + burn the ticket, then insert the score if it qualifies. |

`GET /api/scores` still returns `{ scores }`. New scores must be ≤ `MAX_SCORE` (500000).
The HMAC ticket secret is injected as Lambda env `TICKET_SECRET` (Terraform
`random_password`). Burned ticket ids are `tickets/{jti}` (lifecycle-expired).

## Setup (before `terraform plan` / `apply`)

```bash
cd infra/lambda
npm ci --omit=dev
npm test   # includes verify-package.js (require @aws-sdk/client-s3 + @smithy/*)
```

`node_modules/` is gitignored (`infra/.gitignore`). Terraform zips whatever is on
disk under this directory (minus a few excludes). A partial tree can pass a shallow
`client-s3/package.json` check and still 502 at runtime (`Cannot find module
'@smithy/types'`). Always re-run `npm ci --omit=dev` after Dependabot SDK bumps
**before** `terraform apply` on `aws/envs/stg` or `prod`.

Commit `package.json` and `package-lock.json` when changing dependencies.
Dependabot opens weekly PRs against `staging` for `@aws-sdk/*` updates here.

## Tests

```bash
npm test
```

`verify-package.js` resolves the vendored SDK graph; unit tests use an in-memory
store and do not need AWS credentials.
