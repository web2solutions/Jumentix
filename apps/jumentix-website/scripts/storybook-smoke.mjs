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
  'commercial-pages--home',
  'commercial-pages--home-portuguese',
  'commercial-pages--product',
  'commercial-pages--rest-api-journey',
  'commercial-pages--mobile-product',
  'documentation-shell-navigation--default',
  'documentation-shell-navigation--portuguese',
  'documentation-shell-footer--default',
  'documentation-shell-footer--portuguese',
  // Service Management designer coverage (JUM-488): the zero-build SPA's key
  // UI states, rendered with its real stylesheets.
  'service-management-designer-overview--tab-shell',
  'service-management-designer-overview--workspace-controls',
  'service-management-designer-overview--domain-canvas',
  'service-management-designer-overview--status-surfaces',
  'service-management-designer-overview--entity-inspector',
  'service-management-designer-overview--panels-and-lists',
  'service-management-designer-overview--code-previews',
  'service-management-designer-overview--pwa-update-banner',
];

for (const storyId of requiredStories) {
  if (!entries.some((entry) => entry.id === storyId)) {
    throw new Error(`Storybook smoke check failed: story ${storyId} is missing`);
  }
}

if (entries.length < 54) {
  throw new Error(`Storybook smoke check failed: expected at least 54 entries, found ${entries.length}`);
}

console.log(`Storybook smoke check passed with ${entries.length} indexed entries.`);
