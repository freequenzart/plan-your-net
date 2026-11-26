# Contributing to Plan Your Net

Bug reports, accessible UX improvements, translations, documentation, and focused pull requests are welcome. Contributions are licensed under the project's MIT license. Only contribute work that you have the right to publish.

## Development

Use Node.js 22 or newer and npm. Fork or clone [the GitHub repository](https://github.com/freequenzart/plan-your-net), run `npm ci`, then `npm run dev`. Desktop development uses `npm run dev:electron`. Web and desktop share the renderer; avoid adding duplicate business logic to the Electron main process.

Before opening a pull request, run:

```sh
npm run typecheck
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

For Electron changes, also run `npm run test:electron` on a supported desktop environment. CI tests the Windows desktop build. `npm run format` applies the formatting rules.

## Changes and tests

- Keep changes focused and explain the user-visible behavior and verification in the pull request.
- Add regression tests for changed domain behavior. Cover both German and English messages; key parity is type-checked.
- Preserve optional planning fields, component references, and the version-1 JSON/SVG format. Existing storage identifiers are deliberately retained for compatibility with the earlier Netmap name.
- Keep the renderer sandboxed and free of Node APIs. Never execute imported SVG markup or insert unescaped user data into HTML.
- Respect reduced motion, keyboard navigation, responsive layouts, and the edit/view/build modes.
- Use synthetic example plans. Do not upload workplace floor plans, real device inventories, credentials, or personal data in issues, tests, screenshots, or sample exports.
- Do not commit generated output, dependencies, certificates, environment files, or signing secrets.

Discuss substantial features before implementation. Use the issue forms for reproducible bugs and feature requests. Screenshots should be sanitized. Do not report security vulnerabilities in public issues; see SECURITY.md.

## Release ownership

Only maintainers create release tags and review the resulting draft releases. See `docs/RELEASING.md`. The workflow files do not grant GitHub account or repository permissions; administrators configure those in repository settings.
