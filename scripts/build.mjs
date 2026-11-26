import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const outputDirectory = resolve('dist');

export async function prepareOutput(destination = outputDirectory) {
  await mkdir(destination, { recursive: true });
  await cp('public', destination, { recursive: true });
  await cp('LICENSE', resolve(destination, 'LICENSE'));
  await cp('THIRD_PARTY_NOTICES.md', resolve(destination, 'THIRD_PARTY_NOTICES.md'));
  const html = (await readFile('index.html', 'utf8'))
    .replaceAll('./dist/', './')
    .replaceAll('./public/', './');
  await writeFile(resolve(destination, 'index.html'), html);
}

export function buildOptions(development = false, watching = false, destination = outputDirectory) {
  return {
    entryPoints: { app: 'src/main.ts' },
    bundle: true,
    outdir: resolve(destination, 'assets'),
    format: 'iife',
    target: 'es2022',
    minify: !development && !watching,
    sourcemap: development || watching,
    assetNames: 'fonts/[name]-[hash]',
    loader: { '.ttf': 'file' },
    define: { __DEV__: String(development) },
    logLevel: 'info',
    plugins: [
      {
        name: 'static-files',
        setup(builder) {
          builder.onEnd(async (result) => {
            if (result.errors.length) return;
            await prepareOutput(destination);
            console.log('[plan-your-net] Build complete.');
          });
        },
      },
    ],
  };
}

export function watchStaticFiles(buildContext) {
  let pending = Promise.resolve();
  const rebuild = () => {
    pending = pending.then(() => buildContext.rebuild()).catch((error) => console.error(error));
  };
  const watchers = [watch('index.html', rebuild), watch('public', { recursive: true }, rebuild)];
  return () => watchers.forEach((watcher) => watcher.close());
}

export function handleShutdown(buildContext, cleanup = () => {}) {
  const stop = async () => {
    cleanup();
    await buildContext.dispose();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await rm(outputDirectory, { recursive: true, force: true });
  if (process.argv.includes('--watch')) {
    const buildContext = await context(buildOptions(false, true));
    await buildContext.watch();
    handleShutdown(buildContext, watchStaticFiles(buildContext));
    console.log('[plan-your-net] Watching TypeScript, CSS, HTML, and public assets.');
  } else {
    await build(buildOptions());
  }
}
