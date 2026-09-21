import fs from 'node:fs';
import path from 'node:path';
import type { GenerationPlan } from './types';
import { SourceResolutionError } from './types';
import { SOURCE_MESSAGES } from './messages';
import { buildPlanFromOasDocument, type InterfaceDefaults } from './planBuilder';
import { parseDocumentText } from './oas';

/**
 * Resolve the Users preset OAS path.
 * Prefer `templates/backend/spec/1.0.0.yml` when packaged; else fixtures.
 */
export function resolveUsersPresetPath(override?: string): string {
  if (override) {
    return path.isAbsolute(override) ? override : path.resolve(process.cwd(), override);
  }

  const packageRoot = path.resolve(__dirname, '..', '..');
  const templateSpec = path.join(packageRoot, 'templates', 'backend', 'spec', '1.0.0.yml');
  if (fs.existsSync(templateSpec)) return templateSpec;

  const fixture = path.join(packageRoot, 'fixtures', 'users-oas.yml');
  if (fs.existsSync(fixture)) return fixture;

  throw new SourceResolutionError(
    'Source resolution failed: Users preset OAS not found under templates/backend/spec or fixtures/.'
  );
}

/**
 * Load the Users preset (`--preset users`) into a GenerationPlan.
 */
export async function loadPresetSource(
  preset: string,
  defaults: InterfaceDefaults,
  presetPath?: string
): Promise<GenerationPlan> {
  const name = (preset || 'users').toLowerCase();
  if (name !== 'users') {
    throw new SourceResolutionError(SOURCE_MESSAGES.INVALID_PRESET(preset));
  }

  const absolute = resolveUsersPresetPath(presetPath);
  const doc = parseDocumentText(fs.readFileSync(absolute, 'utf8'), absolute);
  return buildPlanFromOasDocument(doc, defaults);
}
