import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const allowedStatuses = new Set([
  'pending',
  'requirements_draft',
  'requirements_ready',
  'design_draft',
  'design_ready',
  'tasks_ready',
  'in_progress',
  'verification',
  'done',
  'blocked',
]);

export const requiredRootFiles = [
  'README.md',
  'OPERATING_MODEL.md',
  'CHECKPOINTS.md',
  'feature_list.json',
  'docs/architecture.md',
  'docs/conventions.md',
  'docs/security-rules.md',
  'docs/verification.md',
  'templates/requirements.md',
  'templates/design.md',
  'templates/tasks.md',
  'templates/security-review.md',
  'templates/migration-checklist.md',
  'templates/release-notes.md',
  'progress/current.md',
  'progress/history.md',
];

export function requiredSpecFilesForStatus(status) {
  if (status === 'pending') return [];
  if (['requirements_draft', 'requirements_ready', 'blocked'].includes(status)) {
    return ['requirements.md'];
  }
  if (['design_draft', 'design_ready'].includes(status)) {
    return ['requirements.md', 'design.md'];
  }
  if (['tasks_ready', 'in_progress', 'verification', 'done'].includes(status)) {
    return ['requirements.md', 'design.md', 'tasks.md'];
  }
  return [];
}

export function validateSdd(root = process.cwd()) {
  const sddRoot = join(root, 'sdd');
  const featureListPath = join(sddRoot, 'feature_list.json');
  const failures = [];

  for (const file of requiredRootFiles) {
    if (!existsSync(join(sddRoot, file))) {
      failures.push(`Missing required SDD file: ${file}`);
    }
  }

  let featureList;
  try {
    featureList = JSON.parse(readFileSync(featureListPath, 'utf8'));
  } catch (error) {
    failures.push(`Invalid feature_list.json: ${error.message}`);
  }

  if (featureList) {
    const features = Array.isArray(featureList.features) ? featureList.features : [];
    if (features.length === 0) {
      failures.push('feature_list.json must contain at least one feature.');
    }

    const active = features.filter((feature) => feature.status === 'in_progress');
    if (active.length > 1) {
      failures.push(`Only one feature may be in_progress. Found: ${active.map((f) => f.slug).join(', ')}`);
    }

    for (const feature of features) {
      if (!feature.id || !feature.slug || !feature.description) {
        failures.push(`Feature is missing id, slug or description: ${JSON.stringify(feature)}`);
        continue;
      }

      if (!allowedStatuses.has(feature.status)) {
        failures.push(`Feature ${feature.slug} has invalid status: ${feature.status}`);
      }

      if (feature.sdd === true) {
        for (const specFile of requiredSpecFilesForStatus(feature.status)) {
          const path = join(sddRoot, 'specs', feature.slug, specFile);
          if (!existsSync(path)) {
            failures.push(`Feature ${feature.slug} is SDD and ${feature.status}, but lacks ${specFile}.`);
          }
        }
      }
    }
  }

  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = validateSdd();

  if (failures.length > 0) {
    console.error('SDD validation failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('SDD validation OK');
}
