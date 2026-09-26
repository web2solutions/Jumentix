import SOURCE_MESSAGES from './messages';
import { isDesignerExport, readLocalDocument } from './oas';
import { buildPlanFromDesignerState, loadDesignerCore } from './planBuilder';
import { SourceResolutionError } from './types';

import type { InterfaceDefaults } from './planBuilder';
import type { GenerationPlan } from './types';

/**
 * Load a designer suite export JSON into a GenerationPlan.
 */
export async function loadDesignerExportSource(
  fromPath: string,
  defaults: InterfaceDefaults
): Promise<GenerationPlan> {
  const doc = readLocalDocument(fromPath);
  if (!isDesignerExport(doc)) {
    throw new SourceResolutionError(
      SOURCE_MESSAGES.INVALID_DESIGNER_EXPORT('not a designer suite export')
    );
  }

  const { buildStateFromSuiteExport } = await loadDesignerCore();
  const imported = buildStateFromSuiteExport(doc);
  if (!imported.ok) {
    throw new SourceResolutionError(
      SOURCE_MESSAGES.INVALID_DESIGNER_EXPORT(String(imported.reason || 'import-failed'))
    );
  }

  return buildPlanFromDesignerState(
    imported.state as Parameters<typeof buildPlanFromDesignerState>[0],
    defaults
  );
}

/**
 * Build a plan from an already-parsed designer export document (tests / catalog).
 */
export async function planFromDesignerDocument(
  doc: Record<string, unknown>,
  defaults: InterfaceDefaults
): Promise<GenerationPlan> {
  if (!isDesignerExport(doc)) {
    throw new SourceResolutionError(
      SOURCE_MESSAGES.INVALID_DESIGNER_EXPORT('not a designer suite export')
    );
  }
  const { buildStateFromSuiteExport } = await loadDesignerCore();
  const imported = buildStateFromSuiteExport(doc);
  if (!imported.ok) {
    throw new SourceResolutionError(
      SOURCE_MESSAGES.INVALID_DESIGNER_EXPORT(String(imported.reason || 'import-failed'))
    );
  }
  return buildPlanFromDesignerState(
    imported.state as Parameters<typeof buildPlanFromDesignerState>[0],
    defaults
  );
}
