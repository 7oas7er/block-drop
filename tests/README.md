# Block Drop tests

Automated checks for the static game under `../block-drop/`. The game itself stays free of a package manager; this folder owns Node + Playwright only.

## What runs

| Suite | Tool | Covers |
|-------|------|--------|
| `unit/` | Node.js test runner + coverage | Move, rotate, lock/clear, pause/restart, high-score helpers |
| `e2e/` | Playwright (Chromium) | Page chrome, high-score list, keyboard move/rotate, pause |

CI runs `npm test` before deploying when `staging` or `main` is updated (see `.github/workflows/deploy-block-drop.yml`).

## Local

```bash
cd tests
npm ci
npx playwright install chromium
npm test
```

Unit only: `npm run test:unit`  
E2E only: `npm run test:e2e`
