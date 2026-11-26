# Third-Party Notices

Plan Your Net is licensed under MIT; its dependencies and bundled assets retain their own licenses.

## Included in the web and desktop renderer

| Component      | Purpose      | License / notice                                                                    |
| -------------- | ------------ | ----------------------------------------------------------------------------------- |
| Lucide 0.468.0 | Vector icons | ISC and embedded icon notices; see `licenses/LUCIDE-LICENSE` in built distributions |
| DM Sans        | Local font   | SIL Open Font License 1.1; see `licenses/DM-SANS-LICENSE.txt`                       |
| Manrope        | Local font   | SIL Open Font License 1.1; see `licenses/MANROPE-LICENSE.txt`                       |

Source copies of these notices are in `public/licenses/`. Build output copies them unchanged. The application favicon and interface source are covered by the project license.

## Desktop runtime

Desktop packages additionally distribute Electron, Chromium, Node.js, and their bundled components under their respective licenses. Preserve `LICENSE.electron.txt`, `LICENSES.chromium.html`, and the other runtime notices included by Electron Builder when redistributing the unpacked application. These components are not relicensed under the project's MIT license.

## Build and test tooling

TypeScript, esbuild, Electron Builder, sharp, png-to-ico, Prettier, Playwright, fflate, yaml, and other development dependencies are used for building, testing, or assembling releases, rather than loaded by the application renderer. Their packages retain their upstream license files. The dependency lockfile records the resolved tool versions. Review dependency and license changes before publishing updated binaries.

This inventory documents the current distribution design; it is not legal advice or a substitute for reviewing the notices and licenses of a particular release.
