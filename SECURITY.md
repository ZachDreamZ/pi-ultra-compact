# Security Policy for pi-ultra-compact

## Supported Versions

We follow semver for releases. Security patches are applied to the latest minor version.

| Version | Supported          |
|---------|-------------------|
| 0.9.x   | ✅ Active support |
| < 0.9   | ❌ End of life    |

## Reporting a Vulnerability

If you discover a security vulnerability in pi-ultra-compact, please do NOT open a public GitHub issue.

Instead, email the maintainer directly at **zachdreamz@users.noreply.github.com** with:

- A brief description of the issue
- Steps to reproduce (proof of concept preferred)
- Affected versions
- Any proposed fix (optional)

You should receive a response within 48 hours. If you don't, please follow up.

## What to Expect

1. **Acknowledgment** — we confirm receipt within 48 hours
2. **Triage** — we assess severity and impact within 5 business days
3. **Fix** — a patch is prepared and merged within 14 days (critical issues faster)
4. **Release** — a new patch version is published to npm
5. **Disclosure** — the vulnerability is publicly disclosed after the fix is released

## Scope

The following are IN scope:
- Remote code execution via crafted compaction input
- Data leakage through summary generation
- Denial of service via excessive token estimation
- Arbitrary file read/write via file operation extraction

The following are OUT of scope:
- Social engineering attacks
- Physical attacks
- Dependency vulnerabilities with known CVEs already covered by npm audit

## Security-Related Configuration

For production deployments:

1. **cap `maxEvictionLevel`** — Set to `EvictionLevel.STRIP_BULK_OUTPUT` to prevent full message removal
2. **disable auto-compact** — Set `autoCompact: false` to prevent unexpected context modification
3. **audit npm dependencies** — Run `npm audit` regularly
4. **pin versions** — Use exact dependency versions in production via `package-lock.json`

## Responsible Disclosure

We follow coordinated disclosure. Researchers who report valid vulnerabilities will be credited in the CHANGELOG (if they wish). Please allow us reasonable time to fix issues before public disclosure.

## Third-Party Dependencies

This package uses peer dependencies (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`). Security issues in those packages should be reported to their respective maintainers.
