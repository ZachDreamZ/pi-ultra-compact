# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.9.x   | :white_check_mark: |
| < 0.9   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in pi-ultra-compact, please report it privately.

**Do not** open a public GitHub issue. Instead, email the maintainer directly or open a draft security advisory at:

https://github.com/ZachDreamZ/pi-ultra-compact/security/advisories/new

We will acknowledge receipt within 48 hours and provide a timeline for resolution.

## What We Need

- Description of the vulnerability
- Steps to reproduce (PoC preferred)
- Affected versions
- Potential impact

## Scope

- The compaction engine (`extensions/engine.ts`)
- The Pi extension integration (`extensions/index.ts`)
- npm package distribution

Out of scope: Pi platform itself, dependencies not maintained by this project.

## Disclosure

We follow coordinated disclosure — we will notify affected users and publish a fix before public disclosure.

## Recognition

We credit reporters who follow responsible disclosure in the CHANGELOG.
