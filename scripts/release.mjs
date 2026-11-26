import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { strToU8, zipSync } from 'fflate';

const metadata = JSON.parse(await readFile('package.json', 'utf8'));
if (
  metadata.name !== 'plan-your-net' ||
  !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(metadata.version)
)
  throw new Error('Invalid release name or version.');
const version = metadata.version;
const tagIndex = process.argv.indexOf('--check-version');
if (tagIndex !== -1) {
  if (process.argv[tagIndex + 1] !== `v${version}`)
    throw new Error(`Release tag must match package.json: v${version}`);
  console.log(`Release version verified: v${version}`);
  process.exit(0);
}

async function collect(directory, prefix = '') {
  const files = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const name = prefix + entry.name;
    if (entry.isDirectory())
      Object.assign(files, await collect(join(directory, entry.name), `${name}/`));
    else if (entry.isFile() && !name.endsWith('.map'))
      files[name] = [
        new Uint8Array(await readFile(join(directory, entry.name))),
        { mtime: new Date(2020, 0, 1) },
      ];
    else if (!entry.isFile()) throw new Error(`Refusing unsupported release entry: ${name}`);
  }
  return files;
}

const output = resolve('artifacts');
const files = await collect('dist');
for (const required of [
  'index.html',
  'assets/app.js',
  'assets/app.css',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
]) {
  if (!files[required])
    throw new Error(`Web build is incomplete: ${required}. Run npm run build first.`);
}
files['START-HERE.txt'] = [
  strToU8(
    'Plan Your Net\n\nExtract the complete archive and open index.html in a current browser, or upload its contents to a static web server. Keep all asset folders together.\n\nThis app works locally without an account or application backend. Back up plans using JSON exports.\n',
  ),
  { mtime: new Date(2020, 0, 1) },
];
const assets = [];
const webName = `Plan-Your-Net-${version}-web.zip`;
const archive = zipSync(files, { level: 9 });
let executable;
const exeName = `Plan-Your-Net-${version}-x64.exe`;
if (!process.argv.includes('--web')) executable = await readFile(join('release', exeName));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await writeFile(join(output, webName), archive);
assets.push({ name: webName, contents: archive });
if (executable) {
  await cp(join('release', exeName), join(output, exeName));
  assets.push({ name: exeName, contents: executable });
}
const sums =
  assets
    .map((asset) => `${createHash('sha256').update(asset.contents).digest('hex')}  ${asset.name}`)
    .join('\n') + '\n';
await writeFile(join(output, 'SHA256SUMS.txt'), sums);
console.log(
  `Release artifacts created in ${output}:\n${assets.map((asset) => asset.name).join('\n')}\nSHA256SUMS.txt`,
);
