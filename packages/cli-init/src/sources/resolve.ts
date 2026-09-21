import type { GenerationPlan, SourceResolveOptions } from './types';
import { SourceResolutionError } from './types';
import { SOURCE_MESSAGES } from './messages';
import { validateGenerationPlan } from './validate';
import {
  parseDb,
  parseHttp,
  parseRealtime,
  type InterfaceDefaults
} from './planBuilder';
import { loadCatalogSource } from './catalog';
import { loadDesignerExportSource } from './designerExport';
import {
  isDesignerExport,
  isHttpUrl,
  isOpenApiDocument,
  loadOasSource,
  readLocalDocument
} from './oas';
import { loadPresetSource } from './preset';

function buildDefaults(options: SourceResolveOptions): InterfaceDefaults {
  return {
    http: parseHttp(options.http),
    realtime: parseRealtime(options.realtime),
    db: parseDb(options.db),
    mode: options.mode,
    frontend: options.frontend,
    offline: options.offline
  };
}

/**
 * Resolve `--from` / `--preset` into a validated GenerationPlan.
 * When `--from` is omitted, defaults to `--preset users`.
 */
export async function resolveSources(options: SourceResolveOptions = {}): Promise<GenerationPlan> {
  const defaults = buildDefaults(options);
  const from = String(options.from || '').trim();
  let plan: GenerationPlan;

  if (from) {
    if (isHttpUrl(from)) {
      plan = await loadCatalogSource(from, defaults, options.fetchImpl);
    } else {
      const doc = readLocalDocument(from);
      if (isDesignerExport(doc)) {
        plan = await loadDesignerExportSource(from, defaults);
      } else if (isOpenApiDocument(doc)) {
        plan = await loadOasSource(from, defaults);
      } else {
        throw new SourceResolutionError(
          SOURCE_MESSAGES.INVALID_FROM(from)
        );
      }
    }
  } else {
    const preset = String(options.preset || 'users').trim() || 'users';
    plan = await loadPresetSource(preset, defaults, options.presetPath);
  }

  validateGenerationPlan(plan);
  return plan;
}

export function printPlanSummary(
  plan: GenerationPlan,
  log: (message?: string) => void
): void {
  log('GenerationPlan resolved:');
  log(`  mode: ${plan.mode}`);
  log(`  services: ${plan.services.map((s) => `${s.id}(${s.kind})`).join(', ')}`);
  log(
    `  domains: ${plan.domains.map((d) => `${d.name || d.id}[${d.entities.map((e) => e.name).join('|')}]`).join(', ')}`
  );
  log(`  contracts.oasPerService: ${Object.keys(plan.contracts.oasPerService).join(', ') || '(none)'}`);
  if (plan.frontend) {
    log(`  frontend.modules: ${plan.frontend.modules.join(', ')} offline=${plan.frontend.offline}`);
  }
}
