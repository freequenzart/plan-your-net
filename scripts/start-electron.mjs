import electron from 'electron';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function launchElectron(destination = resolve('dist-electron'), options = {}) {
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  if (options.development) environment.PLAN_YOUR_NET_ELECTRON_DEV = '1';
  else delete environment.PLAN_YOUR_NET_ELECTRON_DEV;
  return spawn(electron, [resolve(destination, 'main.cjs'), ...(options.args || [])], {
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: environment,
    windowsHide: true,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    await access('dist-electron/main.cjs');
  } catch {
    console.error('No Electron build found. Run npm run build:electron first.');
    process.exit(1);
  }
  const smoke = process.argv.includes('--smoke-test');
  const child = launchElectron(undefined, {
    capture: smoke,
    args: smoke ? ['--smoke-test', '--disable-gpu'] : [],
  });
  let output = '';
  if (smoke) {
    child.stdout.on('data', (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  }
  const timer = smoke
    ? setTimeout(() => {
        console.error('Electron smoke test timed out.');
        child.kill();
        process.exitCode = 1;
      }, 45000)
    : undefined;
  child.on('error', (error) => {
    if (timer) clearTimeout(timer);
    console.error(error);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    if (timer) clearTimeout(timer);
    process.exitCode = code ?? (signal ? 1 : 0);
    if (smoke && !output.includes('[plan-your-net-electron] Smoke test:')) process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill());
}
