# Release checklist

## GitHub repository setup

The repository is [github.com/freequenzart/plan-your-net](https://github.com/freequenzart/plan-your-net), and the local `origin` remote and package URLs point there. The `main` branch is published. The project name has not been assessed for trademark or name availability.

1. Review the complete staged diff before every commit. Keep `node_modules/`, build output, `release/`, and `artifacts/` out of Git; `.gitignore` already excludes these generated directories.
2. The active `Protect main` ruleset requires pull requests, resolved conversations, up-to-date branches, and successful `Checks (ubuntu-latest)` / `Checks (windows-latest)` jobs. It blocks force pushes and branch deletion; approvals are not required for this single-maintainer repository.
3. Private vulnerability reporting is enabled. The Code of Conduct lists maintainer [@freequenzart](https://github.com/freequenzart) as the moderation contact.
4. Secret scanning, push protection, Dependency Graph, Dependabot alerts, and Dependabot security updates are enabled. Actions are restricted to `actions/*` and pinned to full commit SHAs; review these settings if workflow dependencies change.
5. Review source, history, examples, screenshots, dependency licenses, and artifacts for private data or secrets. `.gitignore` is preventive, not a history or secret scanner.
6. Review the MIT attribution, THIRD_PARTY_NOTICES.md, and Electron runtime notices. Confirm you have rights to all included material.

For an optional public web demo, **GitHub Actions** is selected as the source in **Settings → Pages**. Review environment access rules, then manually run **Deploy Web Demo**. No Pages deployment runs automatically on a push. Add the Pages URL to the repository About section only after deployment succeeds.

## Local release verification

Use Node.js 22 or newer. From a clean checkout:

```sh
npm ci
npm run release:check
npm run typecheck
npm run format:check
npm test
npx playwright install chromium
npm run test:e2e
npm run test:electron
npm run package:electron
npm run build
npm run release:artifacts
```

Windows x64 packaging is the configured desktop distribution target. Run one writer per output directory. Review the generated EXE on a clean Windows profile. Binaries remain unsigned unless you separately configure a signing provider; never put certificates or credentials in Git.

For only the static website, run `npm run release:web` to produce the web ZIP and its checksum. For screenshots based exclusively on synthetic example data, run `npm run screenshots` after installing Chromium.

`artifacts/` contains the versioned web ZIP, portable EXE if requested, and `SHA256SUMS.txt`. Extract the ZIP completely and open its index.html, or deploy its contents on static hosting. Checksums are integrity checks, not signatures. To verify a Windows download:

```powershell
Get-FileHash '.\Plan-Your-Net-1.1.0-x64.exe' -Algorithm SHA256
```

## Tagged GitHub releases

1. Set the intended version in package.json and update package-lock.json. Convert the Unreleased changelog section into dated release notes before publishing.
2. Let CI pass on the commit to release. Create and push a matching `v<version>` tag, for example `v1.1.0`, when you are ready.
3. The prepared release workflow verifies the tag, builds/tests the app on Windows, creates artifacts and checksums, and creates a **draft** GitHub release. It uses the repository supplied by GitHub at runtime, not a hardcoded account URL.
4. Review the draft, attached licenses, checksums, unsigned-Windows warning, and release notes before manually publishing. No npm publishing or automatic-update service is configured.

GitHub-hosted CI, release permissions, repository rules, Pages, private reporting, and remote release execution cannot be validated by local checks. Configure and verify these repository settings after pushing the initial branch.

## Compatibility after the rename

The visible product and internal UI identifiers use Plan Your Net naming. The `plan-your-net-app` custom element and drag-and-drop MIME types are implementation details and may change. Compatibility identifiers remain unchanged: `netmap.*` Local Storage keys, the `netmap-document` SVG metadata ID, and the `%APPDATA%/Netmap` / `Netmap Development` profile directories. This allows existing plans and preferences to be read without destructive migration. Browser origins are still separate; moving the folder or opening a new URL may require a JSON transfer.
