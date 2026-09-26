export { main, printRootHelp, runAsCli } from './cli';
export { looksLikeLegacyInvocation, mapLegacyServiceTypeToMode, parseArgv } from './args';
export { createPrompt } from './prompt';
export { readInitConfig, writeInitConfig } from './config';
export {
  loadCatalogSource,
  loadDesignerExportSource,
  loadOasSource,
  loadPresetSource,
  printPlanSummary,
  resolveSources,
  SOURCE_MESSAGES,
  SourceResolutionError,
  validateGenerationPlan
} from './sources';
export type {
  GenerationMode,
  GenerationPlan,
  PlanDomain,
  PlanEntity,
  PlanService,
  SourceResolveOptions
} from './sources';
export {
  assembleWorkspace,
  bakeMergedOas,
  buildDockerCompose,
  buildManifestJson,
  buildRootPackageJson,
  buildServicePackageJson,
  computeUnusedPaths,
  domainsForService,
  generateBackend,
  generateBackendService,
  generateFrontend,
  listGeneratedFiles,
  mapDbChoiceToDriver,
  mergeServiceOas,
  needsRealtimeRedis,
  renderCompositionRoot,
  renderEnvDev,
  resolveEntityOperations,
  resolvePrimaryDb,
  shouldKeepRelativePath,
  writeFrontendEnv
} from './generators';
export type {
  AssembleWorkspaceOptions,
  AssembleWorkspaceResult,
  EnvRenderInput,
  GenerateBackendOptions,
  GenerateBackendResult,
  GeneratedServiceResult,
  GenerateFrontendOptions,
  GenerateFrontendResult,
  SlicePlan,
  WorkspaceAnswers
} from './generators';
