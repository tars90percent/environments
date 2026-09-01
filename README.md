# Environments

TARS's monorepo for CASE and the portal, used to preserve and inspect vendor RL-task samples.

## Layout

- `AGENTS.md` is the single operating policy used by repository Codex tasks and production CASE.
- `apps/case` contains the Feishu-facing CASE service, canonical registry, capture tools, and Harbor controller.
- `apps/portal` contains the researcher-facing portal, including the CASE catalog and a source-controlled public benchmark reference.

The applications retain separate packages, lockfiles, tests, Railway services, secrets, and deployment checks.

## Local verification

```sh
npm run check:case
npm run test:case
npm run build:case
npm run test:portal
npm run lint:portal
```

Build the production CASE image from the monorepo root so it can package the root policy:

```sh
docker build --file apps/case/Dockerfile --tag case:test .
```

## Railway

CASE uses the repository root as its build context and `apps/case/Dockerfile` as its Dockerfile. Its deployment watch paths must include `/AGENTS.md`, `/apps/case/**`, and any shared package it imports.

The portal uses `apps/portal` as its service root and retains its own build and start commands. Its deployment watch paths need only include `/apps/portal/**` and any shared package it imports.

Both services deploy independently from `main`. A portal change does not redeploy CASE, while a root policy change does because that file is CASE's production instruction source.
