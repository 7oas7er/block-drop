# 0007 — Shared edge and observability platform

- **Status:** accepted
- **Date:** 2026-10-21

## Context

Sibling apps on zone `7oas7er.com` and one Grafana Cloud Free stack cannot each own zone rulesets (one per phase) or the same Infinity / GitHub plugin objects. Putting those in Block Drop made Netrunner implicitly depend on this repo.

## Decision

Shared zone policy and shared Grafana stack objects live in [`7oas7er/platform`](https://github.com/7oas7er/platform) (`shared-edge`, `shared-obs`). This app’s Cloudflare root is DNS-only; Grafana root does not create Infinity or install the GitHub plugin. Canonical ADR text: platform `docs/adr/0001-shared-edge-and-obs.md`.

## Consequences

- Dependency graph is **app → platform**, never Netrunner → Block Drop.
- Agents must not recreate zone rulesets, Infinity DS `infinity-cloudflare`, or the GitHub Cloud plugin in this repo.
- Origin-verify secret rotation updates platform `shared-edge` tfvars, not `infra/terraform/cloudflare`.
