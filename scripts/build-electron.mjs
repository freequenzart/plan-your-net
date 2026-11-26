import { build } from 'esbuild';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOptions } from './build.mjs';
import { generateElectronIcons } from './icons.mjs';

export const desktopOutput = resolve('dist-electron');

export function electronMainOptions(destination = desktopOutput, development = false) {
  return {
    entryPoints: ['electron/main.ts'],
    outfile: resolve(destination, 'main.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
    sourcemap: development,
    logLevel: 'info',
    plugins: [
      {
        name: 'electron-icons',
        setup(builder) {
          builder.onStart(() => generateElectronIcons(destination));
        },
      },
    ],
  };
}

export function electronRendererOptions(destination = desktopOutput, development = false) {
  const webOutput = resolve(destination, 'web');
  const options = buildOptions(false, development, webOutput);
  options.sourcemap = development;
  options.plugins.push({
    name: 'electron-content-security-policy',
    setup(builder) {
      builder.onEnd(async (result) => {
        if (result.errors.length) return;
        const index = resolve(webOutput, 'index.html');
        const html = await readFile(index, 'utf8');
        const policy =
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
        await writeFile(
          index,
          html.replace(
            '</head>',
            `<meta http-equiv="Content-Security-Policy" content="${policy}">\n</head>`,
          ),
        );
      });
    },
  });
  return options;
}

export async function buildElectron() {
  await rm(desktopOutput, { recursive: true, force: true });
  await build(electronRendererOptions());
  await build(electronMainOptions());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  await buildElectron();
