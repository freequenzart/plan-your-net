import { context } from 'esbuild';
import { once } from 'node:events';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { electronMainOptions, electronRendererOptions } from './build-electron.mjs';
import { watchStaticFiles } from './build.mjs';
import { launchElectron } from './start-electron.mjs';

const destination = resolve('dist-electron-dev');
const smokeTest = process.argv.includes('--smoke-test');
await rm(destination, { recursive: true, force: true });
let running = null;
let stopping = false;
let restarting = Promise.resolve();
const ready = { main: false, renderer: false };

async function stopWindow() {
  if (!running || running.exitCode !== null || running.signalCode !== null) return;
  const exited = once(running, 'exit');
  running.kill();
  await exited;
}

function restartWindow() {
  restarting = restarting
    .then(async () => {
      await stopWindow();
      if (stopping) return;
      running = launchElectron(destination, {
        development: true,
        args: smokeTest ? ['--smoke-test', '--disable-gpu'] : [],
      });
      running.on('error', (error) => console.error(error));
      if (smokeTest)
        running.once('exit', (code) =>
          console.log(`[plan-your-net-electron] Smoke window closed (${code}).`),
        );
      console.log('[plan-your-net-electron] Development window started.');
    })
    .catch((error) => console.error(error));
  return restarting;
}

function restartPlugin(part) {
  return {
    name: `electron-restart-${part}`,
    setup(builder) {
      builder.onEnd(async (result) => {
        ready[part] = result.errors.length === 0;
        if (ready.main && ready.renderer) await restartWindow();
      });
    },
  };
}

const mainOptions = electronMainOptions(destination, true);
mainOptions.plugins.push(restartPlugin('main'));
const rendererOptions = electronRendererOptions(destination, true);
rendererOptions.plugins.push(restartPlugin('renderer'));
const [main, renderer] = await Promise.all([context(mainOptions), context(rendererOptions)]);
const closeWatchers = watchStaticFiles(renderer);
await Promise.all([main.watch(), renderer.watch()]);
console.log(
  '[plan-your-net-electron] Watching renderer, desktop main process, HTML, and static assets.',
);

async function shutdown() {
  if (stopping) return;
  stopping = true;
  closeWatchers();
  await restarting;
  await stopWindow();
  await Promise.all([main.dispose(), renderer.dispose()]);
  process.exit(0);
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
