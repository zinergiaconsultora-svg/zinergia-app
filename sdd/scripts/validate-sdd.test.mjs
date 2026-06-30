import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { requiredRootFiles, requiredSpecFilesForStatus, validateSdd } from './validate-sdd.mjs';

function writeFixture({ features, specs = {} }) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-validator-'));
  const sddRoot = join(root, 'sdd');

  for (const file of requiredRootFiles) {
    const path = join(sddRoot, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file === 'feature_list.json' ? JSON.stringify({ features }, null, 2) : `${file}\n`);
  }

  for (const [slug, files] of Object.entries(specs)) {
    const specRoot = join(sddRoot, 'specs', slug);
    mkdirSync(specRoot, { recursive: true });
    for (const file of files) {
      writeFileSync(join(specRoot, file), `${file}\n`);
    }
  }

  return root;
}

function feature(status, slug = `feature-${status}`) {
  return {
    id: `TEST-${status}`,
    slug,
    description: `Feature in ${status}`,
    status,
    sdd: true,
  };
}

test('status artifact matrix matches the SDD gates', () => {
  assert.deepEqual(requiredSpecFilesForStatus('pending'), []);
  assert.deepEqual(requiredSpecFilesForStatus('requirements_ready'), ['requirements.md']);
  assert.deepEqual(requiredSpecFilesForStatus('design_ready'), ['requirements.md', 'design.md']);
  assert.deepEqual(requiredSpecFilesForStatus('tasks_ready'), ['requirements.md', 'design.md', 'tasks.md']);
  assert.deepEqual(requiredSpecFilesForStatus('in_progress'), ['requirements.md', 'design.md', 'tasks.md']);
  assert.deepEqual(requiredSpecFilesForStatus('verification'), ['requirements.md', 'design.md', 'tasks.md']);
  assert.deepEqual(requiredSpecFilesForStatus('done'), ['requirements.md', 'design.md', 'tasks.md']);
});

test('requirements_ready requires requirements only', () => {
  const slug = 'requirements-only';
  const root = writeFixture({
    features: [feature('requirements_ready', slug)],
    specs: { [slug]: ['requirements.md'] },
  });

  assert.deepEqual(validateSdd(root), []);
});

test('design_ready requires design but not tasks', () => {
  const slug = 'design-without-tasks';
  const root = writeFixture({
    features: [feature('design_ready', slug)],
    specs: { [slug]: ['requirements.md', 'design.md'] },
  });

  assert.deepEqual(validateSdd(root), []);
});

test('in_progress requires requirements, design, and tasks', () => {
  const slug = 'missing-tasks';
  const root = writeFixture({
    features: [feature('in_progress', slug)],
    specs: { [slug]: ['requirements.md', 'design.md'] },
  });

  assert.match(validateSdd(root).join('\n'), /lacks tasks\.md/);
});

test('single active feature invariant is preserved', () => {
  const first = feature('in_progress', 'first-active');
  const second = feature('in_progress', 'second-active');
  const root = writeFixture({
    features: [first, second],
    specs: {
      [first.slug]: ['requirements.md', 'design.md', 'tasks.md'],
      [second.slug]: ['requirements.md', 'design.md', 'tasks.md'],
    },
  });

  assert.match(validateSdd(root).join('\n'), /Only one feature may be in_progress/);
});
