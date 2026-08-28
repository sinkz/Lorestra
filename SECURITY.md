# Security Policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for the repository when available. If private reporting is not configured, contact the maintainers through a private channel listed on the repository profile.

Include the affected version, reproduction steps, expected impact, and any suggested mitigation. We will acknowledge a valid report as soon as practical and coordinate disclosure after a fix is available.

## Current security boundary

The hackathon build uses removable local mock adapters. It does not provide production authentication, durable multi-user writes, rate limiting, or Cloudflare storage. Do not expose development write adapters to the public internet.

Public deployments should remain read-only until authentication, authorization, audit storage, abuse controls, and backup procedures are configured.

## Secrets

Lorestra never requires secrets in source control. Use Wrangler secrets or the chosen deployment platform's encrypted secret store. Repository examples contain names only—never live IDs, tokens, credentials, or production database identifiers.
