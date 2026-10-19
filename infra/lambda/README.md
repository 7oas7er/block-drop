# High-scores Lambda

Runtime: Node.js 22 (`nodejs22.x`), arm64. Handler: `high-scores.handler`.

Node.js 18+ Lambda runtimes do **not** include the AWS SDK. This package vendors
`@aws-sdk/client-s3` into the deployment zip via Terraform `archive_file`.

## Setup (before `terraform plan` / `apply`)

```bash
cd infra/lambda
npm ci --omit=dev
```

`node_modules/` is gitignored (`infra/.gitignore`). Commit `package.json` and
`package-lock.json` when changing dependencies. Dependabot opens weekly PRs against
`staging` for `@aws-sdk/*` updates in this directory.

## Tests

```bash
npm test
```

Unit tests use an in-memory store and do not need AWS credentials.
