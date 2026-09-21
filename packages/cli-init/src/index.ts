export { main, printRootHelp, runAsCli } from './cli';
export { parseArgv, looksLikeLegacyInvocation, mapLegacyServiceTypeToMode } from './args';
export { createPrompt } from './prompt';
export { readInitConfig, writeInitConfig } from './config';
export {
  resolveSources,
  printPlanSummary,
  validateGenerationPlan,
  SourceResolutionError,
  SOURCE_MESSAGES,
  loadOasSource,
  loadDesignerExportSource,
  loadCatalogSource,
  loadPresetSource
} from './sources';
export type {
  GenerationPlan,
  GenerationMode,
  PlanService,
  PlanDomain,
  PlanEntity,
  SourceResolveOptions
} from './sources';
export {
  generateBackend,
  generateBackendService,
  generateFrontend,
  bakeMergedOas,
  writeFrontendEnv,
  resolveEntityOperations,
  mergeServiceOas,
  renderEnvDev,
  mapDbChoiceToDriver,
  computeUnusedPaths,
  shouldKeepRelativePath,
  buildServicePackageJson,
  domainsForService,
  renderCompositionRoot,
  assembleWorkspace,
  buildRootPackageJson,
  buildDockerCompose,
  buildManifestJson,
  listGeneratedFiles,
  resolvePrimaryDb,
  needsRealtimeRedis
} from './generators';
export type {
  GenerateBackendOptions,
  GenerateBackendResult,
  GeneratedServiceResult,
  GenerateFrontendOptions,
  GenerateFrontendResult,
  EnvRenderInput,
  SlicePlan,
  AssembleWorkspaceOptions,
  AssembleWorkspaceResult,
  WorkspaceAnswers
} from './generators';
