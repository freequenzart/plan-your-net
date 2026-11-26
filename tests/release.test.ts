import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const script = fileURLToPath(new URL('../scripts/release.mjs', import.meta.url));

test('release artifacts contain a portable website, licenses and matching checksums', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'plan-your-net-release-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'dist', 'assets'), { recursive: true });
  await mkdir(join(directory, 'release'));
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ name: 'plan-your-net', version: '1.2.3' }),
  );
  for (const [file, contents] of Object.entries({
    'index.html': '<title>Plan Your Net</title>',
    'assets/app.js': 'console.log("example");',
    'assets/app.css': 'body{}',
    LICENSE: 'MIT fixture',
    'THIRD_PARTY_NOTICES.md': 'Notices fixture',
    'assets/app.js.map': 'not included',
  }))
    await writeFile(join(directory, 'dist', file), contents);
  const executable = Buffer.from('synthetic executable fixture');
  await writeFile(join(directory, 'release', 'Plan-Your-Net-1.2.3-x64.exe'), executable);
  execFileSync(process.execPath, [script], { cwd: directory });
  const archive = await readFile(join(directory, 'artifacts', 'Plan-Your-Net-1.2.3-web.zip'));
  const entries = unzipSync(archive);
  assert(entries['index.html']);
  assert(entries.LICENSE);
  assert(entries['THIRD_PARTY_NOTICES.md']);
  assert(!entries['assets/app.js.map']);
  const sums = await readFile(join(directory, 'artifacts', 'SHA256SUMS.txt'), 'utf8');
  assert(
    sums.includes(
      `${createHash('sha256').update(archive).digest('hex')}  Plan-Your-Net-1.2.3-web.zip`,
    ),
  );
  assert(
    sums.includes(
      `${createHash('sha256').update(executable).digest('hex')}  Plan-Your-Net-1.2.3-x64.exe`,
    ),
  );
  execFileSync(process.execPath, [script, '--check-version', 'v1.2.3'], { cwd: directory });
  assert.throws(() =>
    execFileSync(process.execPath, [script, '--check-version', 'v9.9.9'], {
      cwd: directory,
      stdio: 'pipe',
    }),
  );
  execFileSync(process.execPath, [script, '--web'], {
    cwd: directory,
    env: { ...process.env, TZ: 'Pacific/Honolulu' },
  });
  assert.deepEqual(
    await readFile(join(directory, 'artifacts', 'Plan-Your-Net-1.2.3-web.zip')),
    archive,
  );
});
