import fs from 'node:fs';
import path from 'node:path';

const outputDirectory = path.resolve(process.cwd(), 'storybook-static');
const indexPath = path.join(outputDirectory, 'index.html');
const manifestPath = path.join(outputDirectory, 'index.json');

for (const requiredPath of [indexPath, manifestPath]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Storybook smoke check failed: missing ${requiredPath}`);
  }
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const entries = Object.values(manifest.entries ?? {});
const requiredStories = [
  'design-system-overview--brand-mark',
  'design-system-overview--code-showcase',
  'design-system-overview--site-header',
  'design-system-overview--site-footer',
  'design-system-overview--architecture-flow',
];

for (const storyId of requiredStories) {
  if (!entries.some((entry) => entry.id === storyId)) {
    throw new Error(`Storybook smoke check failed: story ${storyId} is missing`);
  }
}

if (entries.length < 20) {
  throw new Error(`Storybook smoke check failed: expected at least 20 entries, found ${entries.length}`);
}

console.log(`Storybook smoke check passed with ${entries.length} indexed entries.`);
