# Changelog

All notable changes are documented here. Versions follow Semantic Versioning. The next prepared release is **1.1.0**; it has not been published by this preparation.

## Unreleased

### Added

- Initial public-release preparation for Plan Your Net under the MIT license.
- Native Web Component topology editor with rooms, device types, colors, and orthogonal cable routing.
- Separate edit, view, and rollout modes, including component references, purchasing/install checklists, notes, prices, and cable lengths.
- Independent room/device-type grouping and procurement/installation filters.
- Guided onboarding, German/English language packs, light/dark themes, and reduced-motion behavior.
- Local storage, JSON/SVG import/export, and CSV shopping-list export.
- Static web distribution and unsigned Windows x64 portable Electron build using the application favicon.
- Prepared CI, browser tests, draft release workflow, web ZIP generation, and SHA-256 checksums.

### Changed

- Renamed the visible application and artifacts from Netmap to Plan Your Net.
- Kept legacy storage keys, desktop profile directories, custom-element IDs, and SVG metadata identifiers for data compatibility.

### Known limitations

- Windows binaries are not code-signed. macOS/Linux desktop packaging and automatic updates are not configured.
- Storage is local to each origin/profile and is not synchronized between browser and desktop.
- Only application-exported SVGs with compatible metadata can be reimported as editable topology.
- The optional GitHub Pages demo and unsigned Windows releases still require manual review before publication.
