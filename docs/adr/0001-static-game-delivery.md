# 0001 — Static game delivery (no framework / bundler)

- **Status:** accepted
- **Date:** 2026-10-20

## Context

Block Drop is a private falling-block puzzle. The highest leverage is a fast, readable game loop, not a SPA toolchain. Frameworks and bundlers add dependency churn, build steps, and AI temptation to “modernize” without product need.

## Decision

Ship the game as **static HTML, CSS, and plain JS** under `block-drop/` only. No framework, bundler, package manager, or build step for the game. Automated tests live under `tests/` (Node + Playwright) and gate deploy.

## Consequences

- Deploys are an S3 sync of files as written.
- Agents must not introduce React/Vite/etc. unless Frank explicitly overrides this ADR.
- Test tooling may use npm; the game tree must not.
