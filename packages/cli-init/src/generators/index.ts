export {
  generateBackend,
  generateBackendService,
  type GenerateBackendOptions,
  type GenerateBackendResult,
  type GeneratedServiceResult
} from './backend';
export {
  generateFrontend,
  bakeMergedOas,
  writeFrontendEnv,
  applyOfflineFlag,
  type GenerateFrontendOptions,
  type GenerateFrontendResult
} from './frontend';
export {
  mergeServiceOas,
  oasPathCount,
  resolveEntityOperations,
  searchableFieldsForOperation,
  resolveRequestSchemas,
  entityTitleFromOas,
  type ResolvedCrudOperations
} from './frontendOas';
export {
  slugifyIdentifier,
  camelCaseName,
  pascalCaseName,
  writeDomainModule,
  writeModulesIndex,
  patchI18nTitles,
  patchRouterHome,
  type GeneratedModuleResult,
  type GeneratedEntityConfig
} from './frontendModules';
export {
  renderEnvDev,
  mapDbChoiceToDriver,
  mapRealtimeToEnv,
  type EnvRenderInput,
  type EnvDatabaseDriver
} from './env';
export {
  computeUnusedPaths,
  shouldKeepRelativePath,
  HTTP_INTEGRATION_SUITES,
  ALL_HTTP_INTEGRATION_SUITES,
  DB_COMPOSE_FILES,
  ALL_DB_COMPOSE_FILES,
  ALWAYS_KEEP_COMPOSE_FILES,
  type SlicePlan
} from './slice';
export {
  buildServicePackageJson,
  JUMENTIX_RUNTIME_DEPS,
  type PackageJsonInput
} from './packageJson';
export {
  injectDesignerDomains,
  domainsForService,
  isUsersDomain,
  renderCompositionRoot,
  planDomainsToDesignerState,
  type InjectedDomainResult
} from './domains';
export {
  resolveBackendTemplateRoot,
  resolveFrontendTemplateRoot,
  sanitizePackageScope,
  sanitizeServiceId
} from './paths';
export {
  assembleWorkspace,
  buildRootPackageJson,
  buildGitignore,
  buildDockerCompose,
  buildReadme,
  buildProjectJson,
  buildManifestJson,
  listGeneratedFiles,
  sha256File,
  resolvePrimaryDb,
  needsRealtimeRedis,
  type AssembleWorkspaceOptions,
  type AssembleWorkspaceResult,
  type WorkspaceAnswers
} from './workspace';
