# Security Policy

## Supported versions

Security fixes are intended for the latest public stable release. Older development builds and earlier releases do not have a guaranteed maintenance window. No service-level or response-time commitment is currently offered.

## Reporting a vulnerability

Please do not publish vulnerabilities, exploit details, private network plans, or credentials in ordinary GitHub issues.

Private vulnerability reporting is enabled. Submit reports through [the repository's private vulnerability reporting page](https://github.com/freequenzart/plan-your-net/security/advisories/new).

A dedicated security email has not been configured. If GitHub private reporting is unavailable, contact the maintainer [@freequenzart](https://github.com/freequenzart) privately to request a secure channel. Do not include vulnerability details in a public issue.

Useful private reports include the app version, platform, reproduction steps using synthetic data, expected impact, and whether the issue affects the web build, desktop main process, imports, or exports.

## Security boundaries

- The application has no account system or application backend. Plans are stored in the user's browser/Electron profile; JSON, SVG, CSV, backups, and screenshots may expose network information when shared.
- Imported documents are untrusted. Validation must remain in place. Imported SVG markup is never attached to the application DOM.
- Electron uses sandboxing, context isolation, no Node integration in the renderer, restricted navigation/permissions, and a local-only renderer.
- Windows artifacts are currently unsigned. SHA-256 checksums detect changed download bytes but are not a publisher signature. Obtain artifacts only from the [official Releases page](https://github.com/freequenzart/plan-your-net/releases).
- Dependencies must be reviewed and updated. A clean `npm audit` is useful, but is not a full security or license assessment.
