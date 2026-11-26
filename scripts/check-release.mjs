import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from 'yaml';

const required = [
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'docs/RELEASING.md',
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
  '.github/dependabot.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/pull_request_template.md',
  'public/licenses/LUCIDE-LICENSE',
  'public/licenses/DM-SANS-LICENSE.txt',
  'public/licenses/MANROPE-LICENSE.txt',
];
for (const path of required)
  assert((await readFile(path, 'utf8')).trim(), `Missing release file: ${path}`);
const metadata = JSON.parse(await readFile('package.json', 'utf8'));
for (const image of ['docs/images/editor.png', 'docs/images/rollout.png'])
  assert((await readFile(image)).length > 1000, `Missing demo screenshot: ${image}`);
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
assert.equal(metadata.name, 'plan-your-net');
assert.equal(metadata.license, 'MIT');
assert.equal(lock.name, metadata.name);
assert.equal(lock.packages[''].name, metadata.name);
assert.equal(lock.version, metadata.version);
assert.equal(lock.packages[''].version, metadata.version);
assert((await readFile('LICENSE', 'utf8')).includes(metadata.author));

async function sourceFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await sourceFiles(path)));
    else if (entry.isFile() && /\.(?:ts|mjs|cjs|ya?ml|json|html|md)$/.test(entry.name))
      result.push(path);
  }
  return result;
}

function inspectActions(value, path) {
  if (!value || typeof value !== 'object') return;
  if ('uses' in value)
    assert(
      /^actions\/[a-z-]+@[0-9a-f]{40}$/.test(value.uses),
      `Action must be pinned to a full commit SHA: ${path}`,
    );
  for (const child of Object.values(value)) inspectActions(child, path);
}

for (const path of await sourceFiles('.github')) {
  if (!/\.ya?ml$/.test(path)) continue;
  const document = parseDocument(await readFile(path, 'utf8'), { uniqueKeys: true });
  assert.equal(
    document.errors.length,
    0,
    `Invalid YAML: ${path}: ${document.errors.map((error) => error.message).join(', ')}`,
  );
  const value = document.toJS();
  if (path.includes('workflows')) {
    assert(value.name && value.on && value.jobs, `Invalid workflow structure: ${path}`);
    assert.equal(
      value.permissions?.contents,
      'read',
      `Workflow defaults must be read-only: ${path}`,
    );
    assert(
      !value.on.pull_request_target,
      `Do not execute untrusted PR code with privileged triggers: ${path}`,
    );
    inspectActions(value, path);
    if (path.endsWith('release.yml'))
      assert(
        value.jobs.draft.steps.some((step) => step.run?.includes('--draft')),
        'Releases must initially be drafts',
      );
  }
}

const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
];
for (const path of [
  ...(await sourceFiles('src')),
  ...(await sourceFiles('electron')),
  ...(await sourceFiles('scripts')),
  ...(await sourceFiles('tests')),
  'index.html',
  'package.json',
]) {
  const contents = await readFile(path, 'utf8');
  assert(
    !patterns.some((pattern) => pattern.test(contents)),
    `Potential embedded secret in ${path}; inspect locally without publishing its contents.`,
  );
}
console.log(
  'PASS: MIT/package identity, lockfile, release documents, pinned workflow structure, and limited source secret-pattern check.',
);
console.log(
  'Owner setup still required: a private moderation contact, default-branch rules after the initial push, the first Pages deployment/URL, and review of the final public files/history.',
);
