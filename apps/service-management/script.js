/**
 * script.js — the orchestrator of the Service Management designer.
 *
 * After JUM-468 (state/persistence core) and JUM-469 (this refactor) the
 * monolith is split into modules with explicit interfaces; this file keeps
 * only what is genuinely orchestration: element lookup, event wiring,
 * rendering glue and boot.
 *
 * Module map (acyclic — imports only ever point downwards):
 *
 *   src/state/designerState.js        state, persistence, history, normalisers (DOM-free)
 *   src/store/*.js                    IDesignerStore port + localStorage (transitional) and Cana
 *                                     adapters + selection seam (DOM-free)
 *   src/model/modelQueries.js         pure helpers over the model (DOM-free)
 *   src/validation/modelValidation.js collectModelIssues engine (DOM-free)
 *   src/exporters/designerExporters.js the 7 export document builders (DOM-free)
 *   src/importers/designerImporters.js the import document→model mappers (DOM-free)
 *   src/ui/tabs.js                    tab switching (DOM)
 *   src/ui/canvas.js                  canvas: pan/zoom/snap, domains/entities, edges, mini-map (DOM)
 *   src/ui/inspectors.js              side panels, lists, diff/model-check renderers (DOM)
 *   script.js                         this file: wiring + glue
 *
 * `render()` below calls the per-area renderers in exactly the pre-refactor
 * order — the monolith's implicit sequencing (options before the inspector
 * that reads them, domains before edges) is preserved as an explicit
 * sequence.
 */

import {
  DOMAIN_COLORS,
  FIELD_TYPES,
  createDesignerState,
  defaultFields,
  normalizeContractInput,
  normalizeDeploymentInput,
  normalizeField,
  normalizeOptionalNumber,
  normalizeRbacPolicyInput,
  parseCommaSeparated,
  parseEnumValues
} from './src/state/designerState.js';
import { createDesignerSync } from './src/state/designerSync.js';
import {
  deriveTenantScoped,
  validateRbacRule
} from './src/model/rbacContract.js';
import { createDesignerStore } from './src/store/designerStoreFactory.js';
import {
  CANA_MIGRATION_SOURCE_RETENTION_DAYS,
  describeDesignerStorageEnvironment,
  migrateLocalStorageToCana
} from './src/store/canaMigration.js';
import * as model from './src/model/modelQueries.js';
import { isPm2ManagedDeployTarget } from './src/model/deployCapabilityMatrix.js';
import { buildSampleModelPayload } from './src/model/sampleModel.js';
import { collectModelIssues } from './src/validation/modelValidation.js';
import { collectServiceConfigurationIssues } from './src/validation/serviceConfigurationValidation.js';
import { collectDeployTargetIssues } from './src/validation/deployTargetValidation.js';
import {
  collectDeployTargetFieldIssues,
  deployTargetFieldHint,
  duplicateDeployTargetName
} from './src/validation/deployTargetLifecycleValidation.js';
import {
  normalizeInterfaceAdapterInput,
  upsertInterfaceAdapter
} from './src/validation/interfaceAdapterValidation.js';
import {
  buildBoilerplateBundleDocument,
  buildDomainPackageDocument,
  buildJsonExportDocument,
  buildJsonSchemaDocument,
  buildMarkdownExport,
  buildOasDocument
} from './src/exporters/designerExporters.js';
import {
  buildAsyncApiFileSet,
  buildGrpcProto
} from './src/exporters/asyncApiExporters.js';
import {
  buildDomainFromPackage,
  buildDomainsFromOas,
  buildStateFromSuiteExport
} from './src/importers/designerImporters.js';
import {
  flattenBundleFiles,
  renderBundlePreview
} from './src/codegen/hexagonalCodegen.js';
import { createTabs } from './src/ui/tabs.js';
import { createCanvas } from './src/ui/canvas.js';
import { createInspectors } from './src/ui/inspectors.js';

// Runtime env editor metadata — mirrors the allowlists and enum sets enforced by
// server.js (write allowlist = editable tier; read-only keys render disabled).
const RUNTIME_ENV_EDITABLE_DEFAULTS = {
  JUMENTIX_HTTP_FRAMEWORK: 'express',
  JUMENTIX_REALTIME_API: 'no',
  JUMENTIX_REALTIME_API_PROTOCOL: 'websocket',
  JUMENTIX_REALTIME_API_DATABASE_DRIVER: 'Mongo',
  JUMENTIX_DATABASE_DRIVER: 'InMemory',
  JUMENTIX_KEYVALUESTORAGE_DRIVER: 'redis',
  JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: 'inmemory',
  JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER: '',
  JUMENTIX_WEBSOCKET_REDIS_URL: ''
};
const RUNTIME_ENV_ENUM_OPTIONS = {
  JUMENTIX_HTTP_FRAMEWORK: ['express', 'fastify', 'restify', 'cloudflare-workers', 'vercel-functions', 'loopback', 'sails-js', 'feathers', 'derby-js', 'adonis-js', 'total-js'],
  JUMENTIX_REALTIME_API: ['no', 'yes'],
  JUMENTIX_REALTIME_API_PROTOCOL: ['websocket', 'grpc'],
  JUMENTIX_REALTIME_API_DATABASE_DRIVER: ['Mongo', 'PostgreSQL', 'MySQL', 'MS SQL', 'RDS', 'Aurora', 'Cassandra'],
  JUMENTIX_DATABASE_DRIVER: ['InMemory', 'IndexedDB', 'Mongo', 'PostgreSQL', 'MySQL', 'MSSQL', 'Oracle', 'SQLite', 'DynamoDB', 'Cassandra', 'Firebase', 'Aurora', 'RDS'],
  JUMENTIX_KEYVALUESTORAGE_DRIVER: ['redis', 'inmemory'],
  JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: ['inmemory', 'rabbitmq', 'bullmq'],
  JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER: ['', 'cluster', 'redis-streams']
};
// Per-key context hints (JUM-461): enough context for the two driver keys and
// the canonical-spelling rule to be legible without prior knowledge.
const RUNTIME_ENV_FIELD_HINTS = {
  JUMENTIX_HTTP_FRAMEWORK: 'Canonical spellings only: derby-js and sails-js (the backend rejects the derby/sails aliases).',
  JUMENTIX_DATABASE_DRIVER: 'Main application database (REST API persistence).',
  JUMENTIX_REALTIME_API_DATABASE_DRIVER: 'Realtime API (WebSocket/gRPC) database only - does not change the main application database.'
};

let runtimeEnvEditableKeys = Object.keys(RUNTIME_ENV_EDITABLE_DEFAULTS);

// State, persistence, history and normalisation live in the DOM-free core
// (src/state/designerState.js) behind the IDesignerStore port
// (src/store/IDesignerStore.js). Cana is the SOLE store (JUM-484's one-way
// migration retired the transitional LocalStorageDesignerStore — no fallback
// to localStorage, decision 2026-07-29); the factory seam
// (src/store/designerStoreFactory.js) only injects the Cana client.
// `seed` and `render` are function declarations below, hoisted before this
// module body runs. `designerSync` (JUM-485) is created during boot — after
// the initial load — and observed by the save-outcome hook once it exists.
let designerSync = null;
const store = createDesignerStore();
const designerState = createDesignerState({
  store,
  seed,
  render,
  runtimeEnvDefaults: RUNTIME_ENV_EDITABLE_DEFAULTS,
  // JUM-485: every save outcome is observed; an 'unknown' outcome is
  // reconciled by the sync engine (read-back against Cana), never assumed
  // durable. Before the sync engine starts (boot-time seeds), an unknown
  // outcome still surfaces through the status region.
  onSaveResult: (saveResult, attemptedPayload) => {
    if (designerSync) {
      designerSync.reportSaveOutcome(saveResult, attemptedPayload);
    } else if (saveResult && saveResult.status !== 'persisted') {
      showStatus(`A save could not be confirmed (${saveResult.reason || 'unknown outcome'}).`, 'error');
    }
  }
});
const {
  state,
  history,
  saveState,
  withPersist,
  undo,
  redo,
  recomputeIdCounter,
  loadState,
  buildModelSnapshot
} = designerState;

const interaction = {
  spacePressed: false,
  panning: false,
  relationshipPickActive: false,
  relationshipPickFromEntityId: null,
  relationshipAnchorDragActive: false,
  relationshipAnchorFromEntityId: null,
  relationshipAnchorFromSide: null,
  panStartX: 0,
  panStartY: 0,
  scrollStartLeft: 0,
  scrollStartTop: 0,
  // JUM-546: index into state.deployments of the target loaded into the form
  // for edit-in-place; null means the form adds a new target.
  editingDeploymentIndex: null
};

const dom = {
  tabDomainDesignerBtn: document.getElementById('tab-domain-designer-btn'),
  tabInterfaceDesignerBtn: document.getElementById('tab-interface-designer-btn'),
  tabServiceConfigBtn: document.getElementById('tab-service-config-btn'),
  tabDeployManagementBtn: document.getElementById('tab-deploy-management-btn'),
  tabDomainDesigner: document.getElementById('tab-domain-designer'),
  tabInterfaceDesigner: document.getElementById('tab-interface-designer'),
  tabServiceConfig: document.getElementById('tab-service-config'),
  tabDeployManagement: document.getElementById('tab-deploy-management'),
  canvas: document.getElementById('canvas'),
  canvasInner: document.getElementById('canvas-inner'),
  edges: document.getElementById('edges'),
  domainList: document.getElementById('domain-list'),
  status: document.getElementById('selection-status'),
  statusRegion: document.getElementById('status-region'),
  zoomOutBtn: document.getElementById('zoom-out-btn'),
  zoomInBtn: document.getElementById('zoom-in-btn'),
  edgeStyleSelect: document.getElementById('edge-style-select'),
  autoLayoutBtn: document.getElementById('auto-layout-btn'),
  toggleLargeCanvasBtn: document.getElementById('toggle-large-canvas-btn'),
  fitViewBtn: document.getElementById('fit-view-btn'),
  resetViewBtn: document.getElementById('reset-view-btn'),
  miniMap: document.getElementById('mini-map'),
  zoomIndicator: document.getElementById('zoom-indicator'),
  toggleCompactViewBtn: document.getElementById('toggle-compact-view-btn'),
  toggleSnapBtn: document.getElementById('toggle-snap-btn'),
  domainNameInput: document.getElementById('domain-name-input'),
  addDomainBtn: document.getElementById('add-domain-btn'),
  renameDomainBtn: document.getElementById('rename-domain-btn'),
  deleteDomainBtn: document.getElementById('delete-domain-btn'),
  domainColorInput: document.getElementById('domain-color-input'),
  setDomainColorBtn: document.getElementById('set-domain-color-btn'),
  domainUbiquitousLanguageInput: document.getElementById('domain-ubiquitous-language-input'),
  domainOwnerTeamInput: document.getElementById('domain-owner-team-input'),
  domainUpstreamInput: document.getElementById('domain-upstream-input'),
  domainDownstreamInput: document.getElementById('domain-downstream-input'),
  domainIntegrationChannelInput: document.getElementById('domain-integration-channel-input'),
  domainPackageDependenciesInput: document.getElementById('domain-package-dependencies-input'),
  domainSharedValueObjectsInput: document.getElementById('domain-shared-value-objects-input'),
  saveDomainContextBtn: document.getElementById('save-domain-context-btn'),
  clearDomainContextBtn: document.getElementById('clear-domain-context-btn'),
  entityNameInput: document.getElementById('entity-name-input'),
  addEntityBtn: document.getElementById('add-entity-btn'),
  renameEntityBtn: document.getElementById('rename-entity-btn'),
  deleteEntityBtn: document.getElementById('delete-entity-btn'),
  duplicateEntityBtn: document.getElementById('duplicate-entity-btn'),
  entitySearchInput: document.getElementById('entity-search-input'),
  entitySearchBtn: document.getElementById('entity-search-btn'),
  entityTemplateSelect: document.getElementById('entity-template-select'),
  applyEntityTemplateBtn: document.getElementById('apply-entity-template-btn'),
  fromEntitySelect: document.getElementById('from-entity-select'),
  toEntitySelect: document.getElementById('to-entity-select'),
  fromCardSelect: document.getElementById('from-card-select'),
  toCardSelect: document.getElementById('to-card-select'),
  relationshipAutoFkCheck: document.getElementById('relationship-auto-fk-check'),
  addRelationshipBtn: document.getElementById('add-relationship-btn'),
  pickRelationshipBtn: document.getElementById('pick-relationship-btn'),
  relationshipPickStatus: document.getElementById('relationship-pick-status'),
  relationshipList: document.getElementById('relationship-list'),
  relationshipNameInput: document.getElementById('relationship-name-input'),
  relationshipFromEntitySelect: document.getElementById('relationship-from-entity-select'),
  relationshipToEntitySelect: document.getElementById('relationship-to-entity-select'),
  relationshipFromCardSelect: document.getElementById('relationship-from-card-select'),
  relationshipToCardSelect: document.getElementById('relationship-to-card-select'),
  saveRelationshipBtn: document.getElementById('save-relationship-btn'),
  reverseRelationshipBtn: document.getElementById('reverse-relationship-btn'),
  relationshipLabelOffsetXInput: document.getElementById('relationship-label-offset-x-input'),
  relationshipLabelOffsetYInput: document.getElementById('relationship-label-offset-y-input'),
  resetRelationshipLabelOffsetBtn: document.getElementById('reset-relationship-label-offset-btn'),
  relationshipBendXInput: document.getElementById('relationship-bend-x-input'),
  relationshipBendYInput: document.getElementById('relationship-bend-y-input'),
  relationshipAnchorBehaviorSelect: document.getElementById('relationship-anchor-behavior-select'),
  entityInspectorTitle: document.getElementById('entity-inspector-title'),
  entityRenameInput: document.getElementById('entity-rename-input'),
  saveEntityRenameBtn: document.getElementById('save-entity-rename-btn'),
  entityMoveDomainSelect: document.getElementById('entity-move-domain-select'),
  moveEntityBtn: document.getElementById('move-entity-btn'),
  entityAggregateRootCheck: document.getElementById('entity-aggregate-root-check'),
  entityInvariantsInput: document.getElementById('entity-invariants-input'),
  saveEntityRulesBtn: document.getElementById('save-entity-rules-btn'),
  entityRbacActionSelect: document.getElementById('entity-rbac-action-select'),
  entityRbacSuperadminCheck: document.getElementById('entity-rbac-superadmin-check'),
  entityRbacAdminCheck: document.getElementById('entity-rbac-admin-check'),
  entityRbacUserCheck: document.getElementById('entity-rbac-user-check'),
  entityRbacTenantCheck: document.getElementById('entity-rbac-tenant-check'),
  saveEntityRbacBtn: document.getElementById('save-entity-rbac-btn'),
  entityRbacList: document.getElementById('entity-rbac-list'),
  entityContractNameInput: document.getElementById('entity-contract-name-input'),
  entityContractTypeSelect: document.getElementById('entity-contract-type-select'),
  entityContractChannelInput: document.getElementById('entity-contract-channel-input'),
  entityContractVersionInput: document.getElementById('entity-contract-version-input'),
  addEntityContractBtn: document.getElementById('add-entity-contract-btn'),
  entityContractList: document.getElementById('entity-contract-list'),
  entityOasCompositionModeSelect: document.getElementById('entity-oas-composition-mode-select'),
  entityOasCompositionRefsInput: document.getElementById('entity-oas-composition-refs-input'),
  entityOasExternalRefsInput: document.getElementById('entity-oas-external-refs-input'),
  entityOasDiscriminatorInput: document.getElementById('entity-oas-discriminator-input'),
  saveEntityOasCompositionBtn: document.getElementById('save-entity-oas-composition-btn'),
  fieldNameInput: document.getElementById('field-name-input'),
  fieldTemplateSelect: document.getElementById('field-template-select'),
  applyFieldTemplateBtn: document.getElementById('apply-field-template-btn'),
  fieldTypeSelect: document.getElementById('field-type-select'),
  fieldFormatSelect: document.getElementById('field-format-select'),
  fieldEnumInput: document.getElementById('field-enum-input'),
  fieldRequiredCheck: document.getElementById('field-required-check'),
  fieldPkCheck: document.getElementById('field-pk-check'),
  fieldFkCheck: document.getElementById('field-fk-check'),
  fieldUniqueCheck: document.getElementById('field-unique-check'),
  fieldNullableCheck: document.getElementById('field-nullable-check'),
  addFieldBtn: document.getElementById('add-field-btn'),
  entityFieldList: document.getElementById('entity-field-list'),
  entityApiPreviewList: document.getElementById('entity-api-preview-list'),
  exportJsonBtn: document.getElementById('export-json-btn'),
  exportOasBtn: document.getElementById('export-oas-btn'),
  exportMdBtn: document.getElementById('export-md-btn'),
  exportJsonschemaBtn: document.getElementById('export-jsonschema-btn'),
  exportAsyncapiBtn: document.getElementById('export-asyncapi-btn'),
  exportProtoBtn: document.getElementById('export-proto-btn'),
  exportBoilerplateBundleBtn: document.getElementById('export-boilerplate-bundle-btn'),
  exportPackageBtn: document.getElementById('export-package-btn'),
  importJsonBtn: document.getElementById('import-json-btn'),
  importJsonInput: document.getElementById('import-json-input'),
  importOasBtn: document.getElementById('import-oas-btn'),
  importOasInput: document.getElementById('import-oas-input'),
  importPackageBtn: document.getElementById('import-package-btn'),
  importPackageInput: document.getElementById('import-package-input'),
  loadSampleBtn: document.getElementById('load-sample-btn'),
  domainDesignerEmptyState: document.getElementById('domain-designer-empty-state'),
  loadSampleEmptyBtn: document.getElementById('domain-designer-empty-load-sample-btn'),
  interfaceDesignerEmptyState: document.getElementById('interface-designer-empty-state'),
  serviceConfigEmptyState: document.getElementById('service-config-empty-state'),
  deployManagementEmptyState: document.getElementById('deploy-management-empty-state'),
  generateCodePreviewBtn: document.getElementById('generate-code-preview-btn'),
  generateExamplesBtn: document.getElementById('generate-examples-btn'),
  codePreviewOutput: document.getElementById('code-preview-output'),
  examplesPreviewOutput: document.getElementById('examples-preview-output'),
  resetCanvasBtn: document.getElementById('reset-canvas-btn'),
  clearStorageBtn: document.getElementById('clear-storage-btn'),
  undoBtn: document.getElementById('undo-btn'),
  redoBtn: document.getElementById('redo-btn'),
  runModelCheckBtn: document.getElementById('run-model-check-btn'),
  modelCheckList: document.getElementById('model-check-list'),
  exportBlockCriticalCheck: document.getElementById('export-block-critical-check'),
  modelCheckMinSeveritySelect: document.getElementById('model-check-min-severity-select'),
  saveBaselineBtn: document.getElementById('save-baseline-btn'),
  runSchemaDiffBtn: document.getElementById('run-schema-diff-btn'),
  clearBaselineBtn: document.getElementById('clear-baseline-btn'),
  schemaDiffList: document.getElementById('schema-diff-list'),
  interfaceTypeSelect: document.getElementById('interface-type-select'),
  interfaceFrameworkSelect: document.getElementById('interface-framework-select'),
  interfaceEntrypointInput: document.getElementById('interface-entrypoint-input'),
  interfaceControllerInput: document.getElementById('interface-controller-input'),
  addInterfaceAdapterBtn: document.getElementById('add-interface-adapter-btn'),
  interfaceAdapterList: document.getElementById('interface-adapter-list'),
  serviceKindSelect: document.getElementById('service-kind-select'),
  runModeSelect: document.getElementById('run-mode-select'),
  cloudProviderSelect: document.getElementById('cloud-provider-select'),
  serviceStaticAssetsInput: document.getElementById('service-static-assets-input'),
  serviceHttpPortInput: document.getElementById('service-http-port-input'),
  serviceWebsocketPortInput: document.getElementById('service-websocket-port-input'),
  serviceGrpcPortInput: document.getElementById('service-grpc-port-input'),
  saveServiceConfigBtn: document.getElementById('save-service-config-btn'),
  serviceConfigStatus: document.getElementById('service-config-status'),
  serviceRuntimeProfilePreview: document.getElementById('service-runtime-profile-preview'),
  serviceConfigPreview: document.getElementById('service-config-preview'),
  pm2PreviewEnvironmentSelect: document.getElementById('pm2-preview-environment-select'),
  pm2PreviewStatus: document.getElementById('pm2-preview-status'),
  runtimeEnvSelect: document.getElementById('runtime-env-select'),
  runtimeEnvFields: document.getElementById('runtime-env-fields'),
  runtimeEnvRefreshBtn: document.getElementById('runtime-env-refresh-btn'),
  runtimeEnvSaveBtn: document.getElementById('runtime-env-save-btn'),
  runtimeEnvPreview: document.getElementById('runtime-env-preview'),
  runtimeEnvStatus: document.getElementById('runtime-env-status'),
  runtimeEnvTargetFile: document.getElementById('runtime-env-target-file'),
  deployNameInput: document.getElementById('deploy-name-input'),
  deployTypeSelect: document.getElementById('deploy-type-select'),
  deployServiceTypeSelect: document.getElementById('deploy-service-type-select'),
  deployRuntimeProtocolSelect: document.getElementById('deploy-runtime-protocol-select'),
  deployDatabaseDriverSelect: document.getElementById('deploy-database-driver-select'),
  deployKeyvalueDriverSelect: document.getElementById('deploy-keyvalue-driver-select'),
  deployPm2ProfileSelect: document.getElementById('deploy-pm2-profile-select'),
  deployRegionInput: document.getElementById('deploy-region-input'),
  deployRuntimeInput: document.getElementById('deploy-runtime-input'),
  addDeployTargetBtn: document.getElementById('add-deploy-target-btn'),
  cancelDeployTargetEditBtn: document.getElementById('cancel-deploy-target-edit-btn'),
  deployFieldHint: document.getElementById('deploy-field-hint'),
  deployTargetList: document.getElementById('deploy-target-list')
};

// The UI modules. Their factories receive the shared state/interaction
// objects plus callbacks into this file — the explicit interface the
// monolith's closure used to provide. Everything they return is called
// below exactly where the monolith called its own functions.
const tabs = createTabs({ dom, state, saveState });
const canvas = createCanvas({
  dom,
  state,
  interaction,
  actions: {
    withPersist,
    render,
    saveState,
    setSelectedDomain,
    setSelectedEntity,
    handleEntityRelationshipPick,
    addRelationshipFromAnchor
  }
});
const inspectors = createInspectors({
  dom,
  state,
  interaction,
  actions: {
    withPersist,
    render,
    focusEntity,
    deleteRelationship,
    setSelectedDomain,
    editFieldMetadata,
    updateField,
    removeField,
    renderRuntimeEnvironment,
    loadSchemaBaseline,
    showStatus,
    getPm2EcosystemPreview,
    editDeployment,
    duplicateDeployment,
    syncDeploymentEditStateAfterRemoval
  }
});

// Thin delegations to the pure helpers in src/model/modelQueries.js, keeping
// the monolith's call signatures (state closed over here, as before) so the
// retained orchestration below reads exactly as it did pre-refactor.
function normalizedName(value) {
  return model.normalizedName(value);
}

function isDomainNameTaken(name, ignoredDomainId = null) {
  return model.isDomainNameTaken(state.domains, name, ignoredDomainId);
}

function isEntityNameTaken(domain, name, ignoredEntityId = null) {
  return model.isEntityNameTaken(domain, name, ignoredEntityId);
}

function isFieldNameTaken(entity, name, ignoredFieldName = null) {
  return model.isFieldNameTaken(entity, name, ignoredFieldName);
}

function uniqueStrings(values) {
  return model.uniqueStrings(values);
}

function findEntity(entityId) {
  return model.findEntity(state.domains, entityId);
}

function findEntityByName(name) {
  return model.findEntityByName(state.domains, name);
}

function buildRelationshipName(fromEntityId, toEntityId, fromCardinality, toCardinality) {
  return model.buildRelationshipName(state.domains, fromEntityId, toEntityId, fromCardinality, toCardinality);
}

function getEntityRbacPolicy(entity) {
  return model.getEntityRbacPolicy(entity);
}

function toPathToken(value) {
  return model.toPathToken(value);
}

function snapCoordinate(value) {
  return model.snapCoordinate(state.view.snapToGrid, value);
}

function renderRuntimeEnvFields(runtimeValues) {
  const container = dom.runtimeEnvFields;
  if (!container) return;
  container.innerHTML = '';
  const editableSet = new Set(runtimeEnvEditableKeys);
  Object.keys(runtimeValues).forEach((key) => {
    const isEditable = editableSet.has(key);
    const wrapper = document.createElement('div');
    const label = document.createElement('label');
    const fieldId = `runtime-env-field-${key.toLowerCase().replace(/_/g, '-')}`;
    label.setAttribute('for', fieldId);
    label.textContent = isEditable ? key : `${key} (read-only)`;
    wrapper.appendChild(label);

    let field;
    const enumOptions = RUNTIME_ENV_ENUM_OPTIONS[key];
    if (isEditable && enumOptions) {
      field = document.createElement('select');
      enumOptions.forEach((optionValue) => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue === '' ? '(backend default)' : optionValue;
        field.appendChild(option);
      });
      field.value = String(runtimeValues[key] ?? '');
    } else {
      field = document.createElement('input');
      field.type = 'text';
      field.value = String(runtimeValues[key] ?? '');
      field.readOnly = !isEditable;
    }
    field.id = fieldId;
    field.dataset.runtimeKey = key;
    wrapper.appendChild(field);
    const hint = RUNTIME_ENV_FIELD_HINTS[key];
    if (hint) {
      const hintEl = document.createElement('p');
      hintEl.className = 'hint';
      hintEl.textContent = hint;
      wrapper.appendChild(hintEl);
    }
    container.appendChild(wrapper);
  });
}

function renderRuntimeEnvironment() {
  if (!dom.runtimeEnvSelect) return;
  const runtimeEnvironment = state.runtimeEnvironment || {};
  const runtimeValues = runtimeEnvironment.values || {};
  const environment = String(runtimeEnvironment.environment || 'dev');
  const fileName = String(runtimeEnvironment.fileName || '.env.dev');
  dom.runtimeEnvSelect.value = environment;
  renderRuntimeEnvFields(runtimeValues);
  if (dom.runtimeEnvTargetFile) {
    // Per-file targeting made explicit (JUM-480): the panel always names the
    // exact env file the next Save writes, straight from the last API payload.
    dom.runtimeEnvTargetFile.textContent = `Editing target: ${fileName} (environment "${environment}")`;
  }
  if (dom.runtimeEnvPreview) {
    dom.runtimeEnvPreview.textContent = JSON.stringify({
      environment,
      fileName,
      values: runtimeValues
    }, null, 2);
  }
}

// Non-blocking status surfaces (JUM-543). Every former window.alert call site
// announces through the aria-live toast region instead of blocking the UI.
// Destructive-action gates keep their window.confirm — a toast is not a
// substitute for a gate.
let statusHideTimer = null;
function showStatus(message, severity = 'error') {
  if (!dom.statusRegion) return;
  if (statusHideTimer) {
    clearTimeout(statusHideTimer);
    statusHideTimer = null;
  }
  dom.statusRegion.textContent = String(message);
  dom.statusRegion.className = `status-region status-${severity}`;
  dom.statusRegion.hidden = false;
  if (severity === 'info') {
    statusHideTimer = setTimeout(() => {
      dom.statusRegion.hidden = true;
      statusHideTimer = null;
    }, 6000);
  }
}

// JUM-485 question 2: a remote change re-renders without clobbering the
// user's in-flight interaction. The mid-form input value, caret, focus and
// the canvas scroll position are captured before the render and restored
// after it, so a pending local edit survives a remote apply and the status
// region (not a stolen focus) is what announces the change. When the user
// explicitly saves, their version is asserted — last-writer-wins, consistent
// with whole-document sync.
function renderPreservingInteraction() {
  const active = document.activeElement;
  const activeId = active && active.id ? active.id : null;
  const isTextInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  const pending = isTextInput
    ? { value: active.value, selectionStart: active.selectionStart, selectionEnd: active.selectionEnd }
    : null;
  const scrollLeft = dom.canvas ? dom.canvas.scrollLeft : 0;
  const scrollTop = dom.canvas ? dom.canvas.scrollTop : 0;
  render();
  if (dom.canvas) {
    dom.canvas.scrollLeft = scrollLeft;
    dom.canvas.scrollTop = scrollTop;
  }
  if (!activeId) return;
  const element = document.getElementById(activeId);
  if (!element) return;
  if (pending && 'value' in element) {
    element.value = pending.value;
    try {
      element.setSelectionRange(pending.selectionStart, pending.selectionEnd);
    } catch (_) {
      // Some input types (number, color) reject setSelectionRange; the value
      // and focus are still preserved.
    }
  }
  element.focus({ preventScroll: true });
}

// Inline status line of the runtime env panel: load/save failures land here
// with environment, file and cause, instead of a silent console error.
function showRuntimeEnvStatus(message, severity = 'error') {
  if (!dom.runtimeEnvStatus) return;
  dom.runtimeEnvStatus.textContent = String(message);
  dom.runtimeEnvStatus.className = `hint status-line status-${severity}`;
}

// Builds the client-side error from EXACTLY what the API returned — the
// server's error envelope (error/details, plus code/path on the 500
// filesystem class) is surfaced verbatim; there is no client-side remapping.
async function runtimeEnvApiError(response, fallback) {
  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }
  if (!payload || typeof payload !== 'object') return new Error(fallback);
  const parts = [];
  if (payload.error) parts.push(String(payload.error));
  if (payload.details) parts.push(String(payload.details));
  if (payload.code) parts.push(`code: ${String(payload.code)}`);
  if (payload.path) parts.push(`file: ${String(payload.path)}`);
  return new Error(parts.length > 0 ? parts.join(' ') : fallback);
}

async function loadRuntimeEnvironment(environment) {
  const selectedEnvironment = String(environment || state.runtimeEnvironment?.environment || 'dev');
  const query = `?environment=${encodeURIComponent(selectedEnvironment)}`;
  const response = await fetch(`/api/runtime/env${query}`);
  if (!response.ok) {
    throw await runtimeEnvApiError(response, `Could not load environment ${selectedEnvironment}.`);
  }
  const payload = await response.json();
  if (Array.isArray(payload?.editableKeys) && payload.editableKeys.length > 0) {
    runtimeEnvEditableKeys = payload.editableKeys.map((key) => String(key));
  }
  state.runtimeEnvironment = {
    environment: String(payload.environment || selectedEnvironment),
    fileName: String(payload.fileName || ''),
    values: { ...(payload?.values || {}) }
  };
  renderRuntimeEnvironment();
}

async function saveRuntimeEnvironment() {
  const editableSet = new Set(runtimeEnvEditableKeys);
  const values = {};
  if (dom.runtimeEnvFields) {
    dom.runtimeEnvFields.querySelectorAll('[data-runtime-key]').forEach((field) => {
      const key = field.dataset.runtimeKey;
      if (editableSet.has(key)) {
        values[key] = field.value;
      }
    });
  }
  const payload = {
    environment: dom.runtimeEnvSelect?.value || 'dev',
    values
  };
  const response = await fetch('/api/runtime/env', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw await runtimeEnvApiError(response, 'Could not save runtime environment.');
  }
  const saved = await response.json();
  if (Array.isArray(saved?.editableKeys) && saved.editableKeys.length > 0) {
    runtimeEnvEditableKeys = saved.editableKeys.map((key) => String(key));
  }
  state.runtimeEnvironment = {
    environment: String(saved.environment || payload.environment),
    fileName: String(saved.fileName || ''),
    values: { ...(saved?.values || payload.values) }
  };
  saveState();
  renderRuntimeEnvironment();
}

// PM2 ecosystem preview (JUM-480). Transient, server-derived state — held in a
// module-level variable, NOT in the persisted designer state, so the
// `service-management.v1` schema (Requirement 126, Contract 2) is untouched.
// The preview renders whatever the real pm2/ecosystem.*.cjs file defines; no
// process list or package-manager command is hardcoded in the designer.
let pm2EcosystemPreview = null;
function getPm2EcosystemPreview() {
  return pm2EcosystemPreview;
}

// Inline status line of the runtime profile panel's PM2 preview (JUM-543
// pattern): load failures land here with environment, file and cause.
function showPm2PreviewStatus(message, severity = 'error') {
  if (!dom.pm2PreviewStatus) return;
  dom.pm2PreviewStatus.textContent = String(message);
  dom.pm2PreviewStatus.className = `hint status-line status-${severity}`;
}

async function loadPm2EcosystemPreview(environment) {
  const selected = String(environment || 'dev');
  const query = `?environment=${encodeURIComponent(selected)}`;
  const response = await fetch(`/api/runtime/pm2-ecosystem${query}`);
  if (!response.ok) {
    throw await runtimeEnvApiError(response, `Could not load the PM2 ecosystem for ${selected}.`);
  }
  const payload = await response.json();
  pm2EcosystemPreview = {
    environment: String(payload.environment || selected),
    fileName: String(payload.fileName || ''),
    path: String(payload.path || ''),
    exists: Boolean(payload.exists),
    apps: Array.isArray(payload.apps) ? payload.apps : []
  };
  if (dom.pm2PreviewEnvironmentSelect) {
    dom.pm2PreviewEnvironmentSelect.value = pm2EcosystemPreview.environment;
  }
  inspectors.renderPm2EcosystemPreview();
}

// Failure path shared by the select handler and boot: the preview pane itself
// carries the explicit error state instead of going silently stale.
function failPm2EcosystemPreview(environment, error) {
  const message = error instanceof Error ? error.message : 'Could not load the PM2 ecosystem.';
  pm2EcosystemPreview = { environment: String(environment || 'dev'), error: message };
  inspectors.renderPm2EcosystemPreview();
  showPm2PreviewStatus(`PM2 ecosystem "${String(environment || 'dev')}": ${message}`);
}

function nextId(prefix) {
  const value = `${prefix}-${state.idCounter}`;
  state.idCounter += 1;
  return value;
}

function getSelectedDomain() {
  return state.domains.find((domain) => domain.id === state.selectedDomainId) || null;
}

function focusEntity(entityId) {
  const found = findEntity(entityId);
  if (!found) return;
  state.selectedDomainId = found.domain.id;
  state.selectedEntityId = found.entity.id;
  render();
  const zoom = state.view.zoom || 1;
  const targetLeft = (found.domain.x + found.entity.x - 120) * zoom;
  const targetTop = (found.domain.y + found.entity.y - 80) * zoom;
  dom.canvas.scrollTo({
    left: Math.max(0, targetLeft),
    top: Math.max(0, targetTop),
    behavior: 'smooth'
  });
}

function addDomain(name, options = {}) {
  if (isDomainNameTaken(name)) {
    showStatus(`Domain "${name}" already exists.`);
    return null;
  }
  const domain = {
    id: nextId('domain'),
    name,
    color: options.color || DOMAIN_COLORS[state.domains.length % DOMAIN_COLORS.length],
    x: options.x ?? 120 + state.domains.length * 40,
    y: options.y ?? 90 + state.domains.length * 30,
    context: {
      ubiquitousLanguage: String(options?.context?.ubiquitousLanguage || '').trim(),
      ownerTeam: String(options?.context?.ownerTeam || '').trim(),
      upstreamDependencies: parseCommaSeparated(options?.context?.upstreamDependencies || []),
      downstreamDependencies: parseCommaSeparated(options?.context?.downstreamDependencies || []),
      integrationChannel: String(options?.context?.integrationChannel || '').trim(),
      packageDependencies: parseCommaSeparated(options?.context?.packageDependencies || []),
      sharedValueObjects: parseCommaSeparated(options?.context?.sharedValueObjects || [])
    },
    entities: []
  };
  state.domains.push(domain);
  state.selectedDomainId = domain.id;
  return domain;
}

function addEntity(domainId, name, options = {}) {
  const domain = state.domains.find((candidate) => candidate.id === domainId);
  if (!domain) return null;
  if (isEntityNameTaken(domain, name)) {
    showStatus(`Entity "${name}" already exists in ${domain.name}.`);
    return null;
  }
  const index = domain.entities.length;
  const entity = {
    id: nextId('entity'),
    name,
    x: options.x ?? 14 + (index % 2) * 206,
    y: options.y ?? 14 + Math.floor(index / 2) * 120,
    fields: (options.fields || defaultFields()).map((field, fieldIndex) => normalizeField(field, fieldIndex)),
    meta: {
      aggregateRoot: Boolean(options?.meta?.aggregateRoot),
      invariants: Array.isArray(options?.meta?.invariants)
        ? options.meta.invariants.map((item) => String(item).trim()).filter(Boolean)
        : [],
      rbac: normalizeRbacPolicyInput(options?.meta?.rbac),
      contracts: Array.isArray(options?.meta?.contracts)
        ? options.meta.contracts.map((contract, index) => normalizeContractInput(contract, index))
        : [],
      oasComposition: {
        mode: ['oneOf', 'allOf', 'anyOf'].includes(options?.meta?.oasComposition?.mode)
          ? options.meta.oasComposition.mode
          : '',
        refs: parseCommaSeparated(options?.meta?.oasComposition?.refs || []),
        externalRefs: parseCommaSeparated(options?.meta?.oasComposition?.externalRefs || []),
        discriminator: String(options?.meta?.oasComposition?.discriminator || '').trim()
      }
    }
  };
  domain.entities.push(entity);
  state.selectedEntityId = entity.id;
  return entity;
}

function deleteEntity(entityId) {
  state.domains.forEach((domain) => {
    domain.entities = domain.entities.filter((entity) => entity.id !== entityId);
  });
  state.relationships = state.relationships.filter(
    (relationship) => relationship.fromEntityId !== entityId && relationship.toEntityId !== entityId
  );
  if (state.selectedEntityId === entityId) state.selectedEntityId = null;
  if (state.selectedRelationshipId) {
    const stillExists = state.relationships.some((relationship) => relationship.id === state.selectedRelationshipId);
    if (!stillExists) state.selectedRelationshipId = null;
  }
}

function deleteDomain(domainId) {
  const domain = state.domains.find((candidate) => candidate.id === domainId);
  if (!domain) return;
  const ids = new Set(domain.entities.map((entity) => entity.id));
  state.relationships = state.relationships.filter(
    (relationship) => !ids.has(relationship.fromEntityId) && !ids.has(relationship.toEntityId)
  );
  state.domains = state.domains.filter((candidate) => candidate.id !== domainId);
  if (state.selectedDomainId === domainId) state.selectedDomainId = state.domains[0]?.id || null;
  if (state.selectedEntityId && ids.has(state.selectedEntityId)) state.selectedEntityId = null;
  if (state.selectedRelationshipId) {
    const stillExists = state.relationships.some((relationship) => relationship.id === state.selectedRelationshipId);
    if (!stillExists) state.selectedRelationshipId = null;
  }
}

function setSelectedDomain(domainId) {
  state.selectedDomainId = domainId;
  render();
}

function setSelectedEntity(entityId) {
  state.selectedEntityId = entityId;
  render();
}

function addFieldToSelectedEntity() {
  const found = findEntity(state.selectedEntityId);
  if (!found) {
    showStatus('Select an entity first.');
    return;
  }
  const name = dom.fieldNameInput.value.trim();
  if (!name) return;
  if (isFieldNameTaken(found.entity, name)) {
    showStatus(`Field "${name}" already exists in ${found.entity.name}.`);
    return;
  }
  withPersist(() => {
    found.entity.fields.push(normalizeField({
      name,
      type: dom.fieldTypeSelect.value,
      format: dom.fieldFormatSelect.value,
      enumValues: parseEnumValues(dom.fieldEnumInput.value),
      required: dom.fieldRequiredCheck.checked,
      pk: dom.fieldPkCheck.checked,
      fk: dom.fieldFkCheck.checked,
      unique: dom.fieldUniqueCheck.checked,
      nullable: dom.fieldNullableCheck.checked
    }, found.entity.fields.length));
    dom.fieldNameInput.value = '';
    dom.fieldFormatSelect.value = '';
    dom.fieldEnumInput.value = '';
    dom.fieldNullableCheck.checked = false;
    render();
  });
}

function applyFieldTemplateToSelectedEntity() {
  const found = findEntity(state.selectedEntityId);
  if (!found) {
    showStatus('Select an entity first.');
    return;
  }
  const template = dom.fieldTemplateSelect.value;
  if (!template) return;
  const templates = {
    tenant: [
      { name: 'organizationId', type: 'uuid', required: true, fk: true }
    ],
    audit: [
      { name: 'createdBy', type: 'uuid', required: true, fk: true },
      { name: 'updatedBy', type: 'uuid', required: true, fk: true }
    ],
    softDelete: [
      { name: 'isDeleted', type: 'boolean', required: true },
      { name: 'deletedAt', type: 'datetime', required: false, nullable: true }
    ],
    contact: [
      { name: 'emails', type: 'array', required: false, itemsType: 'string', description: 'Collection of e-mails' },
      { name: 'phones', type: 'array', required: false, itemsType: 'string', description: 'Collection of phones' }
    ]
  };
  const items = templates[template];
  if (!items?.length) return;
  withPersist(() => {
    items.forEach((candidate) => {
      if (isFieldNameTaken(found.entity, candidate.name)) return;
      found.entity.fields.push(normalizeField({
        name: candidate.name,
        type: candidate.type || 'string',
        required: Boolean(candidate.required),
        pk: false,
        fk: Boolean(candidate.fk),
        unique: false,
        nullable: Boolean(candidate.nullable),
        itemsType: candidate.itemsType || '',
        description: candidate.description || ''
      }, found.entity.fields.length));
    });
    render();
  });
}

function updateField(entityId, fieldName, nextPartial) {
  const found = findEntity(entityId);
  if (!found) return;
  const target = found.entity.fields.find((field) => field.name === fieldName);
  if (!target) return;
  const nextName = (nextPartial.name ?? target.name).trim();
  if (!nextName) {
    showStatus('Field name cannot be empty.');
    return;
  }
  if (isFieldNameTaken(found.entity, nextName, target.name)) {
    showStatus(`Field "${nextName}" already exists in ${found.entity.name}.`);
    return;
  }
  withPersist(() => {
    target.name = nextName;
    if ('type' in nextPartial && FIELD_TYPES.includes(nextPartial.type)) target.type = nextPartial.type;
    if ('required' in nextPartial) target.required = Boolean(nextPartial.required);
    if ('pk' in nextPartial) target.pk = Boolean(nextPartial.pk);
    if ('fk' in nextPartial) target.fk = Boolean(nextPartial.fk);
    if ('unique' in nextPartial) target.unique = Boolean(nextPartial.unique);
    if ('nullable' in nextPartial) target.nullable = Boolean(nextPartial.nullable);
    if ('format' in nextPartial) target.format = String(nextPartial.format || '').trim();
    if ('description' in nextPartial) target.description = String(nextPartial.description || '').trim();
    if ('enumValues' in nextPartial) target.enumValues = parseEnumValues(nextPartial.enumValues);
    if ('pattern' in nextPartial) target.pattern = String(nextPartial.pattern || '').trim();
    if ('minLength' in nextPartial) target.minLength = normalizeOptionalNumber(nextPartial.minLength);
    if ('maxLength' in nextPartial) target.maxLength = normalizeOptionalNumber(nextPartial.maxLength);
    if ('minimum' in nextPartial) target.minimum = normalizeOptionalNumber(nextPartial.minimum);
    if ('maximum' in nextPartial) target.maximum = normalizeOptionalNumber(nextPartial.maximum);
    if ('itemsType' in nextPartial) {
      target.itemsType = FIELD_TYPES.includes(nextPartial.itemsType) ? nextPartial.itemsType : '';
    }
    if (target.type !== 'array') target.itemsType = '';
    render();
  });
}

function removeField(entityId, fieldName) {
  const found = findEntity(entityId);
  if (!found) return;
  withPersist(() => {
    found.entity.fields = found.entity.fields.filter((field) => field.name !== fieldName);
    render();
  });
}

function addRelationship(fromEntityId, toEntityId, fromCardinality, toCardinality, options = {}) {
  if (!fromEntityId || !toEntityId || fromEntityId === toEntityId) {
    showStatus('Select two different entities to create a relationship.');
    return;
  }
  withPersist(() => {
    if (fromCardinality === 'N' && toCardinality === 'N') {
      const from = findEntity(fromEntityId);
      const to = findEntity(toEntityId);
      if (!from || !to) return;
      const junctionName = `${from.entity.name}${to.entity.name}`;
      const junction = addEntity(
        from.domain.id,
        junctionName,
        {
          x: Math.max(10, Math.min(300, (from.entity.x + to.entity.x) / 2)),
          y: Math.max(10, Math.min(190, (from.entity.y + to.entity.y) / 2)),
          fields: [
            ...defaultFields(),
            { name: `${from.entity.name.toLowerCase()}Id`, type: 'uuid', required: true, pk: false, fk: true, unique: false },
            { name: `${to.entity.name.toLowerCase()}Id`, type: 'uuid', required: true, pk: false, fk: true, unique: false }
          ]
        }
      );
      const relA = {
        id: nextId('rel'),
        fromEntityId: junction.id,
        toEntityId: fromEntityId,
        name: `${junctionName} -> ${from.entity.name}`,
        fromCardinality: 'N',
        toCardinality: '1',
        fromAnchorSide: options.fromAnchorSide || null,
        toAnchorSide: options.toAnchorSide || null,
        anchorBehavior: 'auto',
        bendX: null,
        bendY: null,
        labelOffsetX: 0,
        labelOffsetY: 0
      };
      const relB = {
        id: nextId('rel'),
        fromEntityId: junction.id,
        toEntityId: toEntityId,
        name: `${junctionName} -> ${to.entity.name}`,
        fromCardinality: 'N',
        toCardinality: '1',
        fromAnchorSide: options.fromAnchorSide || null,
        toAnchorSide: options.toAnchorSide || null,
        anchorBehavior: 'auto',
        bendX: null,
        bendY: null,
        labelOffsetX: 0,
        labelOffsetY: 0
      };
      state.relationships.push(relA);
      state.relationships.push(relB);
      state.selectedRelationshipId = relA.id;
      render();
      return;
    }

    const exists = state.relationships.some((relationship) => (
      relationship.fromEntityId === fromEntityId && relationship.toEntityId === toEntityId
    ) || (
      relationship.fromEntityId === toEntityId && relationship.toEntityId === fromEntityId
    ));
    if (exists) {
      showStatus('A relationship between these entities already exists.');
      return;
    }
    const relationship = {
      id: nextId('rel'),
      fromEntityId,
      toEntityId,
      name: buildRelationshipName(fromEntityId, toEntityId, fromCardinality, toCardinality),
      fromCardinality,
      toCardinality,
      fromAnchorSide: options.fromAnchorSide || null,
      toAnchorSide: options.toAnchorSide || null,
      anchorBehavior: 'auto',
      bendX: null,
      bendY: null,
      labelOffsetX: 0,
      labelOffsetY: 0
    };
    state.relationships.push(relationship);
    if (dom.relationshipAutoFkCheck.checked) {
      const fromFound = findEntity(fromEntityId);
      const toFound = findEntity(toEntityId);
      if (fromFound && toFound) {
        if (fromCardinality === 'N' && toCardinality === '1') {
          ensureForeignKeyField(fromFound.entity, toFound.entity.name);
        }
        if (fromCardinality === '1' && toCardinality === 'N') {
          ensureForeignKeyField(toFound.entity, fromFound.entity.name);
        }
      }
    }
    state.selectedRelationshipId = relationship.id;
    render();
  });
}

// Canvas anchor drags end on this callback: the cardinality selects live in
// this file's `dom` map, so the canvas module delegates relationship
// creation back here with the anchor sides it tracked.
function addRelationshipFromAnchor(fromEntityId, toEntityId, toSide) {
  const fromCardinality = dom.fromCardSelect.value || 'N';
  const toCardinality = dom.toCardSelect.value || '1';
  addRelationship(fromEntityId, toEntityId, fromCardinality, toCardinality, {
    fromAnchorSide: interaction.relationshipAnchorFromSide,
    toAnchorSide: toSide
  });
}

function ensureForeignKeyField(entity, referencedEntityName) {
  const fkName = `${String(referencedEntityName || '').trim().toLowerCase()}Id`;
  if (!fkName || fkName === 'id') return;
  const exists = entity.fields.some((field) => normalizedName(field.name) === normalizedName(fkName));
  if (exists) return;
  entity.fields.push(normalizeField({
    name: fkName,
    type: 'uuid',
    required: true,
    pk: false,
    fk: true,
    unique: false
  }, entity.fields.length));
}

function deleteRelationship(relationshipId) {
  withPersist(() => {
    state.relationships = state.relationships.filter((relationship) => relationship.id !== relationshipId);
    if (state.selectedRelationshipId === relationshipId) state.selectedRelationshipId = null;
    render();
  });
}

function saveSelectedRelationship() {
  const relationship = state.relationships.find((candidate) => candidate.id === state.selectedRelationshipId);
  if (!relationship) {
    showStatus('Select a relationship first.');
    return;
  }
  const fromEntityId = dom.relationshipFromEntitySelect.value;
  const toEntityId = dom.relationshipToEntitySelect.value;
  const fromCardinality = dom.relationshipFromCardSelect.value;
  const toCardinality = dom.relationshipToCardSelect.value;
  if (!fromEntityId || !toEntityId || fromEntityId === toEntityId) {
    showStatus('Relationship must link two different entities.');
    return;
  }
  if (!['1', 'N'].includes(fromCardinality) || !['1', 'N'].includes(toCardinality)) {
    showStatus('Cardinality must be "1" or "N".');
    return;
  }
  const duplicate = state.relationships.some((candidate) => {
    if (candidate.id === relationship.id) return false;
    return (
      (candidate.fromEntityId === fromEntityId && candidate.toEntityId === toEntityId) ||
      (candidate.fromEntityId === toEntityId && candidate.toEntityId === fromEntityId)
    );
  });
  if (duplicate) {
    showStatus('A relationship between these entities already exists.');
    return;
  }
  withPersist(() => {
    relationship.fromEntityId = fromEntityId;
    relationship.toEntityId = toEntityId;
    relationship.name = dom.relationshipNameInput.value.trim()
      || buildRelationshipName(fromEntityId, toEntityId, fromCardinality, toCardinality);
    relationship.fromCardinality = fromCardinality;
    relationship.toCardinality = toCardinality;
    relationship.labelOffsetX = normalizeOptionalNumber(dom.relationshipLabelOffsetXInput.value) ?? 0;
    relationship.labelOffsetY = normalizeOptionalNumber(dom.relationshipLabelOffsetYInput.value) ?? 0;
    relationship.bendX = normalizeOptionalNumber(dom.relationshipBendXInput.value);
    relationship.bendY = normalizeOptionalNumber(dom.relationshipBendYInput.value);
    relationship.anchorBehavior = dom.relationshipAnchorBehaviorSelect.value === 'center' ? 'center' : 'auto';
    render();
  });
}

function reverseSelectedRelationship() {
  const relationship = state.relationships.find((candidate) => candidate.id === state.selectedRelationshipId);
  if (!relationship) {
    showStatus('Select a relationship first.');
    return;
  }
  withPersist(() => {
    const nextFromEntityId = relationship.toEntityId;
    const nextToEntityId = relationship.fromEntityId;
    const nextFromCardinality = relationship.toCardinality;
    const nextToCardinality = relationship.fromCardinality;
    relationship.fromEntityId = nextFromEntityId;
    relationship.toEntityId = nextToEntityId;
    relationship.fromCardinality = nextFromCardinality;
    relationship.toCardinality = nextToCardinality;
    relationship.name = buildRelationshipName(
      relationship.fromEntityId,
      relationship.toEntityId,
      relationship.fromCardinality,
      relationship.toCardinality
    );
    render();
  });
}

function setRelationshipPickMode(active) {
  interaction.relationshipPickActive = active;
  if (!active) interaction.relationshipPickFromEntityId = null;
  inspectors.renderPickStatus();
}

function startRelationshipPickFromSelectedEntity() {
  if (!state.selectedEntityId) {
    showStatus('Select an entity first.');
    return;
  }
  interaction.relationshipPickActive = true;
  interaction.relationshipPickFromEntityId = state.selectedEntityId;
  inspectors.renderPickStatus();
}

function handleEntityRelationshipPick(entityId) {
  if (!interaction.relationshipPickActive) return;
  if (!interaction.relationshipPickFromEntityId) {
    interaction.relationshipPickFromEntityId = entityId;
    inspectors.renderPickStatus();
    return;
  }
  const fromId = interaction.relationshipPickFromEntityId;
  const toId = entityId;
  addRelationship(
    fromId,
    toId,
    dom.fromCardSelect.value,
    dom.toCardSelect.value
  );
  setRelationshipPickMode(false);
}

function setSelectedDomainColor(color) {
  const selected = getSelectedDomain();
  if (!selected) {
    showStatus('Select a domain first.');
    return;
  }
  const isHexColor = /^#[0-9a-f]{6}$/i.test(color);
  if (!isHexColor) {
    showStatus('Invalid color.');
    return;
  }
  withPersist(() => {
    selected.color = color;
    render();
  });
}

function saveSelectedDomainContext() {
  const selected = getSelectedDomain();
  if (!selected) {
    showStatus('Select a domain first.');
    return;
  }
  withPersist(() => {
    selected.context = {
      ubiquitousLanguage: String(dom.domainUbiquitousLanguageInput.value || '').trim(),
      ownerTeam: String(dom.domainOwnerTeamInput.value || '').trim(),
      upstreamDependencies: parseCommaSeparated(dom.domainUpstreamInput.value),
      downstreamDependencies: parseCommaSeparated(dom.domainDownstreamInput.value),
      integrationChannel: String(dom.domainIntegrationChannelInput.value || '').trim(),
      packageDependencies: uniqueStrings(parseCommaSeparated(dom.domainPackageDependenciesInput.value)),
      sharedValueObjects: uniqueStrings(parseCommaSeparated(dom.domainSharedValueObjectsInput.value))
    };
    inspectors.renderStatus();
  });
}

function saveSelectedEntityName(name) {
  const found = findEntity(state.selectedEntityId);
  if (!found) {
    showStatus('Select an entity first.');
    return;
  }
  const value = String(name || '').trim();
  if (!value) {
    showStatus('Entity name cannot be empty.');
    return;
  }
  if (isEntityNameTaken(found.domain, value, found.entity.id)) {
    showStatus(`Entity "${value}" already exists in ${found.domain.name}.`);
    return;
  }
  withPersist(() => {
    found.entity.name = value;
    render();
  });
}

function saveSelectedEntityRules() {
  const found = findEntity(state.selectedEntityId);
  if (!found) {
    showStatus('Select an entity first.');
    return;
  }
  withPersist(() => {
    const invariants = String(dom.entityInvariantsInput.value || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    found.entity.meta = found.entity.meta || {};
    found.entity.meta.aggregateRoot = Boolean(dom.entityAggregateRootCheck.checked);
    found.entity.meta.invariants = invariants;
    render();
  });
}

function saveSelectedEntityRbacRule() {
  const found = findEntity(state.selectedEntityId);
  if (!found) {
    showStatus('Select an entity first.');
    return;
  }
  const action = dom.entityRbacActionSelect.value || 'list';
  const roles = [];
  if (dom.entityRbacSuperadminCheck.checked) roles.push('superadmin');
  if (dom.entityRbacAdminCheck.checked) roles.push('admin');
  if (dom.entityRbacUserCheck.checked) roles.push('user');
  // Edit-time gate (JUM-477): a rule the tenant RBAC contract cannot express
  // is rejected with the reason, never persisted and dropped at export.
  // Tenant scoping is derived from the roles — the runtime has no independent
  // tenant-scope knob to honour.
  const rule = { roles, tenantScoped: deriveTenantScoped(roles) };
  const verdict = validateRbacRule(rule);
  if (!verdict.ok) {
    showStatus(verdict.reason);
    return;
  }
  withPersist(() => {
    const policy = getEntityRbacPolicy(found.entity);
    policy[action] = rule;
    inspectors.renderEntityRbacInspector(found.entity);
  });
}

function addSelectedEntityContract() {
  const found = findEntity(state.selectedEntityId);
  if (!found) {
    showStatus('Select an entity first.');
    return;
  }
  const name = String(dom.entityContractNameInput.value || '').trim();
  const type = dom.entityContractTypeSelect.value || 'event';
  const channel = String(dom.entityContractChannelInput.value || '').trim();
  const version = String(dom.entityContractVersionInput.value || '').trim() || '1.0.0';
  if (!name) {
    showStatus('Contract name is required.');
    return;
  }
  withPersist(() => {
    if (!found.entity.meta) found.entity.meta = {};
    if (!Array.isArray(found.entity.meta.contracts)) found.entity.meta.contracts = [];
    found.entity.meta.contracts.push(normalizeContractInput({
      id: nextId('contract'),
      name,
      type,
      channel,
      version,
      payloadSchema: {}
    }, found.entity.meta.contracts.length));
    dom.entityContractNameInput.value = '';
    dom.entityContractChannelInput.value = '';
    dom.entityContractVersionInput.value = '1.0.0';
    inspectors.renderEntityContractsInspector(found.entity);
  });
}

function saveSelectedEntityOasComposition() {
  const found = findEntity(state.selectedEntityId);
  if (!found) {
    showStatus('Select an entity first.');
    return;
  }
  const mode = dom.entityOasCompositionModeSelect.value;
  const refs = parseCommaSeparated(dom.entityOasCompositionRefsInput.value);
  const externalRefs = parseCommaSeparated(dom.entityOasExternalRefsInput.value);
  const discriminator = String(dom.entityOasDiscriminatorInput.value || '').trim();
  withPersist(() => {
    if (!found.entity.meta) found.entity.meta = {};
    found.entity.meta.oasComposition = {
      mode: ['oneOf', 'allOf', 'anyOf'].includes(mode) ? mode : '',
      refs,
      externalRefs,
      discriminator
    };
    inspectors.renderEntityInspector();
  });
}

function duplicateSelectedEntity() {
  const found = findEntity(state.selectedEntityId);
  if (!found) {
    showStatus('Select an entity first.');
    return;
  }
  const baseName = `${found.entity.name}_copy`;
  let candidateName = baseName;
  let suffix = 2;
  while (isEntityNameTaken(found.domain, candidateName)) {
    candidateName = `${baseName}_${suffix}`;
    suffix += 1;
  }
  withPersist(() => {
    const clonedFields = JSON.parse(JSON.stringify(found.entity.fields || []));
    const clonedMeta = JSON.parse(JSON.stringify(found.entity.meta || { aggregateRoot: false, invariants: [] }));
    addEntity(found.domain.id, candidateName, {
      x: Math.min(320, found.entity.x + 22),
      y: Math.min(180, found.entity.y + 22),
      fields: clonedFields,
      meta: clonedMeta
    });
    render();
  });
}

function moveSelectedEntityToDomain(targetDomainId) {
  const found = findEntity(state.selectedEntityId);
  if (!found) {
    showStatus('Select an entity first.');
    return;
  }
  if (!targetDomainId || found.domain.id === targetDomainId) return;
  const targetDomain = state.domains.find((domain) => domain.id === targetDomainId);
  if (!targetDomain) return;
  if (isEntityNameTaken(targetDomain, found.entity.name)) {
    showStatus(`Target domain already has entity "${found.entity.name}".`);
    return;
  }
  withPersist(() => {
    found.domain.entities = found.domain.entities.filter((entity) => entity.id !== found.entity.id);
    found.entity.x = 14 + (targetDomain.entities.length % 2) * 206;
    found.entity.y = 14 + Math.floor(targetDomain.entities.length / 2) * 118;
    targetDomain.entities.push(found.entity);
    state.selectedDomainId = targetDomain.id;
    render();
  });
}

function editFieldMetadata(entityId, fieldName) {
  const found = findEntity(entityId);
  if (!found) return;
  const field = found.entity.fields.find((candidate) => candidate.name === fieldName);
  if (!field) return;
  const draft = {
    description: field.description || '',
    format: field.format || '',
    nullable: Boolean(field.nullable),
    enum: field.enumValues || [],
    pattern: field.pattern || '',
    minLength: field.minLength,
    maxLength: field.maxLength,
    minimum: field.minimum,
    maximum: field.maximum,
    itemsType: field.itemsType || ''
  };
  const raw = window.prompt(
    `Edit OpenAPI field metadata for "${field.name}" as JSON.`,
    JSON.stringify(draft, null, 2)
  );
  if (raw === null) return;
  try {
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    updateField(entityId, fieldName, {
      description: String(parsed.description || '').trim(),
      format: String(parsed.format || '').trim(),
      nullable: Boolean(parsed.nullable),
      enumValues: parseEnumValues(parsed.enum),
      pattern: String(parsed.pattern || '').trim(),
      minLength: normalizeOptionalNumber(parsed.minLength),
      maxLength: normalizeOptionalNumber(parsed.maxLength),
      minimum: normalizeOptionalNumber(parsed.minimum),
      maximum: normalizeOptionalNumber(parsed.maximum),
      itemsType: FIELD_TYPES.includes(parsed.itemsType) ? parsed.itemsType : ''
    });
  } catch (error) {
    showStatus('Invalid JSON metadata payload.');
  }
}

function saveSchemaBaseline() {
  const snapshot = buildModelSnapshot();
  store.saveBaseline(snapshot);
  inspectors.renderSchemaDiffResults([{ severity: 'info', message: 'Baseline saved.' }]);
}

async function loadSchemaBaseline() {
  const result = await store.loadBaseline();
  if (result.status !== 'ok') return null;
  return result.payload;
}

async function runSchemaDiff() {
  const baseline = await loadSchemaBaseline();
  if (!baseline) {
    inspectors.renderSchemaDiffResults([{ severity: 'warn', message: 'No baseline found. Save baseline first.' }]);
    return;
  }
  const current = buildModelSnapshot();
  const changes = [];
  const baseDomainsById = new Map((baseline.domains || []).map((domain) => [domain.id, domain]));
  const currentDomainsById = new Map((current.domains || []).map((domain) => [domain.id, domain]));

  current.domains.forEach((domain) => {
    if (!baseDomainsById.has(domain.id)) {
      changes.push({ severity: 'info', message: `Create table/collection for domain "${domain.name}".` });
    }
  });
  (baseline.domains || []).forEach((domain) => {
    if (!currentDomainsById.has(domain.id)) {
      changes.push({ severity: 'warn', message: `Drop domain "${domain.name}" scope and related entities.` });
    }
  });

  const baseEntities = new Map();
  (baseline.domains || []).forEach((domain) => {
    (domain.entities || []).forEach((entity) => baseEntities.set(entity.id, { domain, entity }));
  });
  const currentEntities = new Map();
  current.domains.forEach((domain) => {
    (domain.entities || []).forEach((entity) => currentEntities.set(entity.id, { domain, entity }));
  });

  currentEntities.forEach(({ domain, entity }, entityId) => {
    if (!baseEntities.has(entityId)) {
      changes.push({ severity: 'info', message: `Create entity "${domain.name}/${entity.name}".` });
      return;
    }
    const baseEntity = baseEntities.get(entityId).entity;
    const baseFieldsByName = new Map((baseEntity.fields || []).map((field) => [normalizedName(field.name), field]));
    const currentFieldsByName = new Map((entity.fields || []).map((field) => [normalizedName(field.name), field]));

    entity.fields.forEach((field) => {
      if (!baseFieldsByName.has(normalizedName(field.name))) {
        changes.push({ severity: 'info', message: `Add field "${domain.name}/${entity.name}.${field.name}" (${field.type}).` });
      }
    });
    (baseEntity.fields || []).forEach((field) => {
      if (!currentFieldsByName.has(normalizedName(field.name))) {
        changes.push({ severity: 'warn', message: `Remove field "${domain.name}/${entity.name}.${field.name}".` });
      }
    });
    entity.fields.forEach((field) => {
      const previous = baseFieldsByName.get(normalizedName(field.name));
      if (!previous) return;
      if (previous.type !== field.type) {
        changes.push({ severity: 'warn', message: `Alter type of "${domain.name}/${entity.name}.${field.name}" from ${previous.type} to ${field.type}.` });
      }
      if (Boolean(previous.required) !== Boolean(field.required)) {
        changes.push({ severity: 'warn', message: `Change required flag on "${domain.name}/${entity.name}.${field.name}" to ${field.required}.` });
      }
    });

    const baseContracts = new Set(((baseEntity.meta?.contracts || [])).map((contract) => `${contract.type}|${contract.name}|${contract.version}`));
    const currentContracts = new Set(((entity.meta?.contracts || [])).map((contract) => `${contract.type}|${contract.name}|${contract.version}`));
    currentContracts.forEach((key) => {
      if (!baseContracts.has(key)) {
        changes.push({ severity: 'info', message: `Add message contract "${domain.name}/${entity.name}" -> ${key}.` });
      }
    });
    baseContracts.forEach((key) => {
      if (!currentContracts.has(key)) {
        changes.push({ severity: 'warn', message: `Remove message contract "${domain.name}/${entity.name}" -> ${key}.` });
      }
    });
  });

  baseEntities.forEach(({ domain, entity }, entityId) => {
    if (!currentEntities.has(entityId)) {
      changes.push({ severity: 'warn', message: `Drop entity "${domain.name}/${entity.name}".` });
    }
  });

  const baseRels = new Set((baseline.relationships || []).map((rel) => `${rel.fromEntityId}|${rel.toEntityId}|${rel.fromCardinality}|${rel.toCardinality}`));
  const currentRels = new Set((current.relationships || []).map((rel) => `${rel.fromEntityId}|${rel.toEntityId}|${rel.fromCardinality}|${rel.toCardinality}`));
  currentRels.forEach((key) => {
    if (!baseRels.has(key)) changes.push({ severity: 'info', message: `Add relationship ${key}.` });
  });
  baseRels.forEach((key) => {
    if (!currentRels.has(key)) changes.push({ severity: 'warn', message: `Remove relationship ${key}.` });
  });

  if (!changes.length) {
    changes.push({ severity: 'info', message: 'No schema changes detected versus baseline.' });
  }
  inspectors.renderSchemaDiffResults(changes);
}

function runModelChecks() {
  const issues = collectModelIssues(state);
  inspectors.renderModelCheckResults(issues);
  return issues;
}

// The export quality gate (Requirement 126 §5). The issue list comes from
// the DOM-free engine in src/validation/modelValidation.js; what remains
// here is the gate's DOM half: render the blocking issues and announce the
// refusal on the non-blocking status region. The gate itself is unchanged —
// it still refuses the export.
function canExportModel() {
  if (!state.view.exportBlockCritical) return true;
  const issues = collectModelIssues(state);
  const criticalCount = issues.filter((issue) => issue.severity === 'error').length;
  if (criticalCount === 0) return true;
  inspectors.renderModelCheckResults(issues);
  showStatus(`Export blocked: ${criticalCount} critical model issue(s). Run "Validate Model" and fix errors before exporting.`);
  return false;
}

// Download glue shared by the export wrappers. The documents
// themselves are built by the DOM-free src/exporters/designerExporters.js
// (JSON/Markdown/JSON Schema/bundle/package/OAS) and
// src/exporters/asyncApiExporters.js (AsyncAPI 3.0 per-transport files and
// the gRPC proto, targeting the canonical spec/asyncapi/ conventions).
function downloadTextFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAsJson() {
  if (!canExportModel()) return;
  downloadTextFile('domain-designer.json', JSON.stringify(buildJsonExportDocument(state), null, 2), 'application/json');
}

function exportAsMarkdown() {
  if (!canExportModel()) return;
  downloadTextFile('domain-designer-model.md', buildMarkdownExport(state), 'text/markdown');
}

function exportAsJsonSchema() {
  if (!canExportModel()) return;
  downloadTextFile('domain-designer-json-schema.json', JSON.stringify(buildJsonSchemaDocument(state), null, 2), 'application/json');
}

function exportAsAsyncApi() {
  if (!canExportModel()) return;
  buildAsyncApiFileSet(state).files.forEach((file) => {
    downloadTextFile(file.fileName, file.content, file.mimeType);
  });
}

function exportAsProto() {
  if (!canExportModel()) return;
  downloadTextFile('async-api.proto', buildGrpcProto(state), 'text/plain');
}

function exportBoilerplateBundle() {
  if (!canExportModel()) return;
  downloadTextFile('domain-designer-boilerplate-bundle.json', JSON.stringify(buildBoilerplateBundleDocument(state), null, 2), 'application/json');
}

function exportAsPackage() {
  if (!canExportModel()) return;
  const selected = getSelectedDomain();
  if (!selected) {
    showStatus('Select a domain to export package.');
    return;
  }
  downloadTextFile(
    `${toPathToken(selected.name) || 'domain'}-package.json`,
    JSON.stringify(buildDomainPackageDocument(selected), null, 2),
    'application/json'
  );
}

function exportAsOas() {
  if (!canExportModel()) return;
  downloadTextFile('domain-designer-oas-3.1.json', JSON.stringify(buildOasDocument(state), null, 2), 'application/json');
}

// Import glue: FileReader + persist/selection/history around the pure
// document→model mappers in src/importers/designerImporters.js (and
// normalizeStatePayload from the JUM-468 core). One mapper failure reason
// maps to exactly one status-region message (the pre-refactor alert text).
// JUM-492: one mapper failure reason maps to exactly one status-region
// message. The mapper (buildDomainFromPackage over the packageVersioning
// core) owns the versioning, dependency-graph and conflict policies; this
// glue only renders outcomes — never window.alert.
function packageImportFailureMessage(result) {
  const packageLabel = result.package ? `'${result.package.name}@${result.package.version}'` : 'package';
  if (result.reason === 'wrong-document-kind') {
    return `This file is a '${String(result.kind)}' document, not a domain package — use the matching import.`;
  }
  if (result.reason === 'unsupported-version') {
    return `Unsupported domain-package document version '${String(result.version)}' — this designer reads up to major version 2.`;
  }
  if (result.reason === 'invalid-package-version') {
    return `Package version '${String(result.version)}' is not a semantic version (major.minor.patch) — import refused.`;
  }
  if (result.reason === 'dependency-cycle') {
    return `Importing ${packageLabel} would close a dependency cycle (${(result.cycle || []).join(' -> ')}) — import refused.`;
  }
  if (result.reason === 'downgrade-rejected') {
    return `Package '${result.package.name}@${result.installed}' is already imported; ${packageLabel} is older — downgrades are refused.`;
  }
  if (result.reason === 'same-version-conflict') {
    return `Package ${packageLabel} is already imported but the file's content differs — same version, different content. Bump the version or reconcile the package; nothing was changed.`;
  }
  return 'Invalid package format.';
}

function importDomainPackage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'));
      const result = buildDomainFromPackage(parsed, state.domains);
      if (!result.ok) {
        showStatus(packageImportFailureMessage(result));
        // A refusal that carries a preview (same-version conflict) renders it
        // on the schema-diff surface, so the user sees exactly which aspects
        // diverged — the merge-preview basis of JUM-492.
        if (Array.isArray(result.preview) && result.preview.length) {
          inspectors.renderSchemaDiffResults(result.preview);
        }
        return;
      }
      if (result.noop) {
        // Idempotent re-import (JUM-492): same package, same version, same
        // content — importing twice changes nothing, proven by test.
        showStatus(`Package '${result.package.name}@${result.package.version}' is already imported and unchanged — nothing to do.`, 'info');
        return;
      }
      if (result.merged) {
        // The merge preview renders BEFORE anything changes; aspects that
        // require a decision (RBAC, invariants, removals, narrowings) keep
        // the existing content and the merge applies only after the user
        // explicitly accepts — a toast is not a substitute for that gate.
        if (result.preview.length) {
          inspectors.renderSchemaDiffResults(result.preview);
        }
        if (result.requiresDecision > 0) {
          const accepted = window.confirm(
            `Merge package '${result.package.name}' ${result.fromVersion} -> ${result.package.version}: `
            + `${result.autoCount} change(s) apply automatically; ${result.requiresDecision} aspect(s) require a decision `
            + '(the existing designer content is kept for them — see the schema-diff panel). Apply the merge?'
          );
          if (!accepted) {
            showStatus(`Merge of package '${result.package.name}@${result.package.version}' cancelled — nothing was changed.`, 'info');
            return;
          }
        }
        withPersist(() => {
          const index = state.domains.findIndex((domain) => domain.id === result.domain.id);
          if (index >= 0) {
            state.domains[index] = result.domain;
          }
          state.selectedDomainId = result.domain.id;
          state.selectedEntityId = result.domain.entities[0]?.id || null;
          recomputeIdCounter();
          render();
        });
        const decisionNote = result.requiresDecision > 0
          ? `; ${result.requiresDecision} aspect(s) kept the existing content (listed in the schema-diff panel)`
          : '';
        showStatus(
          `Package '${result.package.name}' merged ${result.fromVersion} -> ${result.package.version}: ${result.autoCount} change(s) applied${decisionNote}.`,
          'info'
        );
        return;
      }
      withPersist(() => {
        const nextDomain = result.domain;
        state.domains.push(nextDomain);
        state.selectedDomainId = nextDomain.id;
        state.selectedEntityId = nextDomain.entities[0]?.id || null;
        recomputeIdCounter();
        render();
      });
      // Dependency-graph findings never block an import, but they are never
      // silent either — they surface through the status region.
      if (Array.isArray(result.warnings) && result.warnings.length) {
        showStatus(result.warnings.join(' '), 'error');
      }
    } catch (_) {
      showStatus('Could not parse package JSON.');
    }
  };
  reader.readAsText(file);
}

// JUM-547: the suite import maps one mapper failure reason to exactly one
// status-region message. The mapper itself (buildStateFromSuiteExport)
// owns the versioning and compatibility rules of the full-suite document.
function suiteExportFailureMessage(result) {
  if (result.reason === 'wrong-document-kind') {
    return `This file is a '${String(result.kind)}' document, not a suite export — use the matching import.`;
  }
  if (result.reason === 'unsupported-version') {
    return `Unsupported suite export version '${String(result.version)}' — this designer reads up to major version 2.`;
  }
  if (result.reason === 'unknown-sections') {
    return `Suite export carries unknown section(s): ${result.sections.join(', ')} — import refused rather than partially applied.`;
  }
  return 'Invalid suite export document.';
}

function importStateFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const result = buildStateFromSuiteExport(parsed, state);
      if (!result.ok) {
        showStatus(suiteExportFailureMessage(result));
        return;
      }
      const normalized = result.state;
      withPersist(() => {
        state.domains = normalized.domains;
        state.relationships = normalized.relationships;
        state.selectedDomainId = normalized.selectedDomainId;
        state.selectedEntityId = normalized.selectedEntityId;
        state.selectedRelationshipId = normalized.selectedRelationshipId;
        state.interfaces = normalized.interfaces;
        state.serviceConfiguration = normalized.serviceConfiguration;
        state.runtimeEnvironment = normalized.runtimeEnvironment;
        state.deployments = normalized.deployments;
        state.view = normalized.view;
        state.idCounter = normalized.idCounter;
        recomputeIdCounter();
        render();
      }, { recordHistory: false });
      history.past = [];
      history.future = [];
      saveState();
    } catch (error) {
      showStatus('Could not parse JSON file.');
    }
  };
  reader.readAsText(file);
}

function importStateFromOasFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const result = buildDomainsFromOas(parsed);
      if (!result.ok) {
        showStatus(result.reason === 'invalid-oas'
          ? 'Invalid OAS file: components.schemas not found.'
          : 'No schemas found to import.');
        return;
      }
      const nextDomains = result.domains;
      withPersist(() => {
        state.domains = nextDomains;
        // JUM-478: relationships cross the OAS boundary via `x-relations`
        // (endpoints re-keyed to the freshly imported entities).
        state.relationships = result.relationships || [];
        state.selectedDomainId = nextDomains[0]?.id || null;
        state.selectedEntityId = null;
        state.selectedRelationshipId = null;
        state.view = {
          zoom: 1,
          compactEntities: false,
          snapToGrid: true,
          edgeStyle: 'curved',
          modelCheckMinSeverity: 'info',
          exportBlockCritical: true,
          largeCanvasMode: false
        };
        recomputeIdCounter();
        render();
      }, { recordHistory: false });
      history.past = [];
      history.future = [];
      saveState();
    } catch (error) {
      showStatus('Could not parse OAS JSON file.');
    }
  };
  reader.readAsText(file);
}

function generateCodePreview() {
  const found = findEntity(state.selectedEntityId);
  // The preview renders the exact bundle the export emits (same builder,
  // same structure — JUM-476), scoped to the selected entity when there is
  // one so its composition root stays internally consistent.
  const previewState = found
    ? { domains: [{ ...found.domain, entities: [found.entity] }], relationships: [] }
    : state;
  const bundle = buildBoilerplateBundleDocument(previewState);
  dom.codePreviewOutput.textContent = flattenBundleFiles(bundle).length
    ? renderBundlePreview(bundle)
    : '// Select an entity or create domains/entities to preview generated skeletons.';
}

function generateExamplesPreview() {
  const selected = findEntity(state.selectedEntityId);
  const targets = selected
    ? [{ domain: selected.domain, entity: selected.entity }]
    : state.domains.flatMap((domain) => domain.entities.map((entity) => ({ domain, entity })));
  if (!targets.length) {
    dom.examplesPreviewOutput.textContent = '// No entities found for example generation.';
    return;
  }
  const chunks = targets.map(({ domain, entity }) => {
    const schemaName = model.toSchemaName(domain.name, entity.name);
    const requestCreate = model.buildEntityRequestExample(entity, 'create');
    const requestUpdate = model.buildEntityRequestExample(entity, 'update');
    const response = model.buildEntityResponseExample(entity);
    return [
      `// ${domain.name}/${entity.name}`,
      `// create${schemaName} request`,
      JSON.stringify(requestCreate, null, 2),
      `// update${schemaName} request`,
      JSON.stringify(requestUpdate, null, 2),
      `// ${schemaName} response`,
      JSON.stringify(response, null, 2)
    ].join('\n');
  });
  dom.examplesPreviewOutput.textContent = chunks.join('\n\n/* ---------------------------------------- */\n\n');
}

// JUM-548: the first-run state is intentionally EMPTY — no domains, no
// relationships. A first-run user used to get a silently pre-populated toy
// template; the guided per-tab empty states (renderEmptyStates) now explain
// each tab instead, and the realistic sample model is an explicit one-action
// load (loadSampleModel), so the user learns where a model comes from. The
// state core calls this on first run and on recovery; the Reset button calls
// it too — reset therefore means "back to the empty first-run state".
function seed() {
  state.domains = [];
  state.relationships = [];
  state.selectedDomainId = null;
  state.selectedEntityId = null;
  state.selectedRelationshipId = null;
  state.idCounter = 1;
  state.view = {
    zoom: 1,
    compactEntities: false,
    snapToGrid: true,
    edgeStyle: 'curved',
    modelCheckMinSeverity: 'info',
    exportBlockCritical: true,
    largeCanvasMode: false
  };
}

/**
 * JUM-548: load the sample model (src/model/sampleModel.js) through the same
 * normalisation crossing a JSON import takes. Non-destructive by contract:
 * over existing work the load only proceeds after an explicit confirmation —
 * one of the destructive-action gates JUM-543 keeps on `window.confirm` — and
 * even then the previous work is one in-session Undo away (the load records
 * history, unlike file imports which reset it). The status region, not an
 * alert, announces the outcome and names the sample marker.
 */
function loadSampleModel() {
  if (state.domains.length) {
    const confirmed = window.confirm(
      'Load the sample model? This replaces the current domains and relationships (Undo restores them).'
    );
    if (!confirmed) return;
  }
  // JUM-547: the sample document crosses the same suite-import mapper as a
  // file import — one set of versioning/compatibility rules for every entry
  // point. The sample is the model slice only; the tab sections the mapper
  // normalises are not applied here.
  const result = buildStateFromSuiteExport(buildSampleModelPayload(), state);
  if (!result.ok) {
    showStatus(suiteExportFailureMessage(result));
    return;
  }
  const normalized = result.state;
  withPersist(() => {
    state.domains = normalized.domains;
    state.relationships = normalized.relationships;
    state.selectedDomainId = normalized.selectedDomainId;
    state.selectedEntityId = normalized.selectedEntityId;
    state.selectedRelationshipId = normalized.selectedRelationshipId;
    state.view = normalized.view;
    state.idCounter = normalized.idCounter;
    recomputeIdCounter();
    render();
  });
  showStatus(
    'Sample model loaded: the "Users" domain (marked "sample" in the domain list) demonstrates '
    + 'relationships, per-entity RBAC, a message contract and OAS composition. It passes the export '
    + 'gate — try "Validate Model", export it, then delete the sample and start your own model.',
    'info'
  );
}

/**
 * JUM-548: per-tab guided empty states. Each names the tab's first action
 * and describes the tab honestly (the Interface and Deploy tabs are thinner
 * than the Domain Designer, and their empty states say so). The two toggles
 * here track the domain model, which only ever changes through a full
 * render(); the Interface/Deploy toggles live next to their list renderers
 * in src/ui/inspectors.js, because adapters and targets also change through
 * partial renders (delete buttons) that never reach this pass.
 */
function renderEmptyStates() {
  const modelEmpty = state.domains.length === 0;
  if (dom.domainDesignerEmptyState) dom.domainDesignerEmptyState.hidden = !modelEmpty;
  if (dom.serviceConfigEmptyState) dom.serviceConfigEmptyState.hidden = !modelEmpty;
}

// The single render pass, in the monolith's exact order. The pre-refactor
// implicit sequencing — interface adapters/service config/deployments before
// the domain panel, domain list before the canvas, entity options before the
// inspectors that read them, edges and mini-map after the canvas — is
// preserved here as an explicit call sequence.
function render() {
  tabs.renderTabs();
  renderEmptyStates();
  inspectors.renderInterfaceAdapters();
  inspectors.renderServiceConfiguration();
  inspectors.renderDeployments();
  inspectors.renderDomainList();
  inspectors.renderStatus();
  canvas.renderView();
  canvas.renderDomains();
  inspectors.renderEntityOptions();
  inspectors.renderRelationshipList();
  inspectors.syncRelationshipInspector();
  inspectors.renderPickStatus();
  inspectors.renderEntityInspector();
  canvas.renderEdges();
  canvas.renderMiniMap();
  inspectors.renderSchemaDiffStatus();
  generateCodePreview();
  generateExamplesPreview();
  dom.undoBtn.disabled = history.past.length === 0;
  dom.redoBtn.disabled = history.future.length === 0;
}

// Deploy Management lifecycle (JUM-546). The form doubles as the add and the
// edit-in-place surface: `interaction.editingDeploymentIndex === null` adds,
// a number replaces that entry. Every mutation validates the full candidate —
// the JUM-546 field rules (name required/unique, runtime/version pattern,
// region per target type) next to the JUM-481 matrix-content rules — and a
// rejection is announced on the JUM-543 status surface with every reason,
// never alert() and never a silent no-op.

function readDeployTargetForm() {
  return normalizeDeploymentInput({
    name: dom.deployNameInput.value,
    region: dom.deployRegionInput.value,
    runtime: dom.deployRuntimeInput.value,
    deployTarget: dom.deployTypeSelect.value,
    serviceType: dom.deployServiceTypeSelect?.value,
    runtimeProtocol: dom.deployRuntimeProtocolSelect?.value,
    databaseDriver: dom.deployDatabaseDriverSelect?.value,
    keyValueDriver: dom.deployKeyvalueDriverSelect?.value,
    pm2Profile: dom.deployPm2ProfileSelect?.value
  });
}

/**
 * Target-type-aware field guidance (JUM-546 scope 3): the hint line names
 * what the selected matrix row needs — host information and a PM2 profile on
 * PM2-managed targets, a runtime/version on function providers — and the PM2
 * profile select only applies to PM2-managed targets.
 */
function updateDeployTargetFieldHints() {
  const deployTarget = dom.deployTypeSelect?.value || '';
  if (dom.deployFieldHint) {
    dom.deployFieldHint.textContent = deployTargetFieldHint(deployTarget);
  }
  if (dom.deployPm2ProfileSelect) {
    const pm2Managed = isPm2ManagedDeployTarget(deployTarget);
    dom.deployPm2ProfileSelect.disabled = !pm2Managed;
    if (!pm2Managed) dom.deployPm2ProfileSelect.value = '';
  }
}

function clearDeployTargetForm() {
  interaction.editingDeploymentIndex = null;
  dom.deployNameInput.value = '';
  dom.deployRegionInput.value = '';
  dom.deployRuntimeInput.value = '';
  dom.addDeployTargetBtn.textContent = 'Add Target';
  if (dom.cancelDeployTargetEditBtn) dom.cancelDeployTargetEditBtn.hidden = true;
}

function submitDeployTargetForm() {
  const candidate = readDeployTargetForm();
  const issues = [
    ...collectDeployTargetFieldIssues(candidate, state.deployments, {
      excludeIndex: interaction.editingDeploymentIndex
    }),
    ...collectDeployTargetIssues(candidate)
  ];
  if (issues.length > 0) {
    showStatus(issues.map((issue) => issue.message).join(' '));
    return;
  }
  const editingIndex = interaction.editingDeploymentIndex;
  withPersist(() => {
    if (editingIndex === null || !state.deployments[editingIndex]) {
      state.deployments.push(candidate);
    } else {
      state.deployments.splice(editingIndex, 1, candidate);
    }
    clearDeployTargetForm();
    inspectors.renderDeployments();
  }, { recordHistory: false });
  if (editingIndex !== null) {
    showStatus(`Deploy target "${candidate.name}" updated.`, 'info');
  }
}

function editDeployment(index) {
  const target = state.deployments[index];
  if (!target) return;
  interaction.editingDeploymentIndex = index;
  dom.deployNameInput.value = target.name || '';
  dom.deployTypeSelect.value = target.deployTarget || '';
  if (dom.deployServiceTypeSelect) dom.deployServiceTypeSelect.value = target.serviceType || '';
  if (dom.deployRuntimeProtocolSelect) dom.deployRuntimeProtocolSelect.value = target.runtimeProtocol || '';
  if (dom.deployDatabaseDriverSelect) dom.deployDatabaseDriverSelect.value = target.databaseDriver || '';
  if (dom.deployKeyvalueDriverSelect) dom.deployKeyvalueDriverSelect.value = target.keyValueDriver || '';
  if (dom.deployPm2ProfileSelect) dom.deployPm2ProfileSelect.value = target.pm2Profile || '';
  dom.deployRegionInput.value = target.region || '';
  dom.deployRuntimeInput.value = target.runtime || '';
  dom.addDeployTargetBtn.textContent = 'Save Target';
  if (dom.cancelDeployTargetEditBtn) dom.cancelDeployTargetEditBtn.hidden = false;
  updateDeployTargetFieldHints();
  dom.deployNameInput.focus();
}

/**
 * Duplicate a registered target: a DEEP copy (the duplicate is independently
 * editable, never a shared reference), re-normalised to the pinned shape and
 * renamed by the ` (copy)` rule until unique (JUM-546 acceptance criteria).
 */
function duplicateDeployment(index) {
  const source = state.deployments[index];
  if (!source) return;
  const copy = normalizeDeploymentInput(JSON.parse(JSON.stringify(source)));
  copy.name = duplicateDeployTargetName(source.name, state.deployments.map((entry) => entry.name));
  // Inserting before the edited entry shifts its index; keep the edit pointed
  // at the same target.
  if (interaction.editingDeploymentIndex !== null && interaction.editingDeploymentIndex > index) {
    interaction.editingDeploymentIndex += 1;
  }
  withPersist(() => {
    state.deployments.splice(index + 1, 0, copy);
    inspectors.renderDeployments();
  }, { recordHistory: false });
  showStatus(`Duplicated "${source.name}" as "${copy.name}".`, 'info');
}

/**
 * Keep the in-flight edit consistent when the list removes an entry: removing
 * the edited target cancels the edit; removing an earlier one shifts the
 * edited index. Called by `renderDeployments`' delete gate.
 */
function syncDeploymentEditStateAfterRemoval(removedIndex) {
  if (interaction.editingDeploymentIndex === null) return;
  if (interaction.editingDeploymentIndex === removedIndex) {
    clearDeployTargetForm();
  } else if (interaction.editingDeploymentIndex > removedIndex) {
    interaction.editingDeploymentIndex -= 1;
  }
}

function wireEvents() {
  if (dom.tabDomainDesignerBtn) dom.tabDomainDesignerBtn.onclick = () => tabs.setActiveTab('domain-designer');
  if (dom.tabInterfaceDesignerBtn) dom.tabInterfaceDesignerBtn.onclick = () => tabs.setActiveTab('interface-designer');
  if (dom.tabServiceConfigBtn) dom.tabServiceConfigBtn.onclick = () => tabs.setActiveTab('service-config');
  if (dom.tabDeployManagementBtn) dom.tabDeployManagementBtn.onclick = () => tabs.setActiveTab('deploy-management');

  if (dom.interfaceTypeSelect) {
    dom.interfaceTypeSelect.onchange = () => inspectors.renderInterfaceFrameworkOptions(dom.interfaceTypeSelect.value);
  }

  if (dom.addInterfaceAdapterBtn) {
    dom.addInterfaceAdapterBtn.onclick = () => {
      // JUM-545: the candidate is validated BEFORE it touches state, through
      // the same upsert gate the edit-in-place save uses — vocabulary
      // (per-type framework subset), entrypoint/controller-mapping shapes and
      // duplicate detection are reported on the JUM-543 status surface and
      // the add is refused. Type and framework stay selected so registering
      // several adapters of the same kind does not re-pick them each time.
      const candidate = normalizeInterfaceAdapterInput({
        type: dom.interfaceTypeSelect.value,
        framework: dom.interfaceFrameworkSelect.value,
        entrypoint: dom.interfaceEntrypointInput.value,
        controller: dom.interfaceControllerInput.value
      });
      const result = upsertInterfaceAdapter(state.interfaces, candidate);
      if (result.issues.length > 0) {
        showStatus(result.issues.map((issue) => issue.message).join(' '));
        return;
      }
      withPersist(() => {
        state.interfaces = result.adapters;
        dom.interfaceEntrypointInput.value = '';
        dom.interfaceControllerInput.value = '';
        inspectors.renderInterfaceAdapters();
      });
    };
  }

  if (dom.saveServiceConfigBtn) {
    dom.saveServiceConfigBtn.onclick = () => {
      // JUM-544: the candidate is validated BEFORE it touches state. Invalid
      // ports (out of range, or colliding across the protocols the selected
      // service kind actually binds) and run-mode × provider combinations
      // the Requirement 059 matrix has no deploy target for are reported on
      // the tab's status surface and the save is refused — the previous
      // behaviour silently coerced bad ports back to the defaults.
      const parsePort = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return null;
        return Number(raw);
      };
      const candidate = {
        serviceKind: dom.serviceKindSelect.value,
        runMode: dom.runModeSelect.value,
        cloudProvider: dom.cloudProviderSelect.value,
        staticAssetsPath: String(dom.serviceStaticAssetsInput.value || '').trim(),
        ports: {
          rest: parsePort(dom.serviceHttpPortInput?.value),
          websocket: parsePort(dom.serviceWebsocketPortInput?.value),
          grpc: parsePort(dom.serviceGrpcPortInput?.value)
        }
      };
      const issues = collectServiceConfigurationIssues(candidate);
      if (issues.length > 0) {
        inspectors.renderServiceConfigStatus(issues);
        return;
      }
      withPersist(() => {
        state.serviceConfiguration = candidate;
        inspectors.renderServiceConfiguration();
      }, { recordHistory: false });
    };
  }

  if (dom.runtimeEnvRefreshBtn) {
    dom.runtimeEnvRefreshBtn.onclick = async () => {
      const environment = dom.runtimeEnvSelect?.value || 'dev';
      try {
        await loadRuntimeEnvironment(environment);
        showRuntimeEnvStatus(`Environment "${environment}" loaded from ${state.runtimeEnvironment?.fileName || 'env file'}.`, 'info');
      } catch (error) {
        showRuntimeEnvStatus(`Environment "${environment}": ${error instanceof Error ? error.message : 'Could not load runtime environment.'}`);
      }
    };
  }

  if (dom.runtimeEnvSaveBtn) {
    dom.runtimeEnvSaveBtn.onclick = async () => {
      const environment = dom.runtimeEnvSelect?.value || 'dev';
      try {
        await saveRuntimeEnvironment();
        showRuntimeEnvStatus(`Environment "${environment}" saved to ${state.runtimeEnvironment?.fileName || 'env file'}.`, 'info');
      } catch (error) {
        showRuntimeEnvStatus(`Environment "${environment}": ${error instanceof Error ? error.message : 'Could not save runtime environment.'}`);
      }
    };
  }

  if (dom.runtimeEnvSelect) {
    dom.runtimeEnvSelect.onchange = () => {
      const environment = dom.runtimeEnvSelect.value;
      loadRuntimeEnvironment(environment)
        .catch((error) => {
          showRuntimeEnvStatus(`Environment "${environment}": ${error instanceof Error ? error.message : 'Could not load runtime environment.'}`);
        });
    };
  }

  if (dom.pm2PreviewEnvironmentSelect) {
    dom.pm2PreviewEnvironmentSelect.onchange = () => {
      const environment = dom.pm2PreviewEnvironmentSelect.value;
      loadPm2EcosystemPreview(environment)
        .then(() => {
          showPm2PreviewStatus(
            pm2EcosystemPreview?.exists
              ? `PM2 ecosystem for "${environment}" loaded from ${pm2EcosystemPreview.fileName}.`
              : `No PM2 ecosystem file for "${environment}" (${pm2EcosystemPreview?.fileName || 'ecosystem file'}).`,
            'info'
          );
        })
        .catch((error) => failPm2EcosystemPreview(environment, error));
    };
  }

  if (dom.addDeployTargetBtn) {
    // JUM-546: one gate for add and edit-in-place — the full candidate is
    // validated (field lifecycle rules + Requirement 059 matrix rules) before
    // it touches state; rejections report every reason on the status surface.
    dom.addDeployTargetBtn.onclick = submitDeployTargetForm;
  }

  if (dom.cancelDeployTargetEditBtn) {
    dom.cancelDeployTargetEditBtn.onclick = () => {
      clearDeployTargetForm();
      showStatus('Deploy target edit cancelled.', 'info');
    };
  }

  if (dom.deployTypeSelect) {
    dom.deployTypeSelect.onchange = updateDeployTargetFieldHints;
    updateDeployTargetFieldHints();
  }

  dom.addDomainBtn.onclick = () => {
    const value = dom.domainNameInput.value.trim();
    if (!value) return;
    if (isDomainNameTaken(value)) {
      showStatus(`Domain "${value}" already exists.`);
      return;
    }
    withPersist(() => {
      addDomain(value);
      dom.domainNameInput.value = '';
      render();
    });
  };
  dom.domainNameInput.onkeydown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    dom.addDomainBtn.click();
  };
  dom.setDomainColorBtn.onclick = () => setSelectedDomainColor(dom.domainColorInput.value);
  dom.saveDomainContextBtn.onclick = saveSelectedDomainContext;
  dom.clearDomainContextBtn.onclick = () => {
    if (!getSelectedDomain()) return;
    dom.domainUbiquitousLanguageInput.value = '';
    dom.domainOwnerTeamInput.value = '';
    dom.domainUpstreamInput.value = '';
    dom.domainDownstreamInput.value = '';
    dom.domainIntegrationChannelInput.value = '';
    dom.domainPackageDependenciesInput.value = '';
    dom.domainSharedValueObjectsInput.value = '';
    saveSelectedDomainContext();
  };

  dom.renameDomainBtn.onclick = () => {
    const selected = getSelectedDomain();
    if (!selected) return;
    const next = window.prompt('Rename domain', selected.name);
    if (!next || !next.trim()) return;
    if (isDomainNameTaken(next.trim(), selected.id)) {
      showStatus(`Domain "${next.trim()}" already exists.`);
      return;
    }
    withPersist(() => {
      selected.name = next.trim();
      render();
    });
  };

  dom.deleteDomainBtn.onclick = () => {
    const selected = getSelectedDomain();
    if (!selected) return;
    if (!window.confirm(`Delete domain "${selected.name}" and all entities?`)) return;
    withPersist(() => {
      deleteDomain(selected.id);
      render();
    });
  };

  dom.addEntityBtn.onclick = () => {
    const selected = getSelectedDomain();
    if (!selected) return showStatus('Select a domain first.');
    const value = dom.entityNameInput.value.trim();
    if (!value) return;
    if (isEntityNameTaken(selected, value)) {
      showStatus(`Entity "${value}" already exists in ${selected.name}.`);
      return;
    }
    withPersist(() => {
      addEntity(selected.id, value);
      dom.entityNameInput.value = '';
      render();
    });
  };
  dom.applyEntityTemplateBtn.onclick = () => {
    const found = findEntity(state.selectedEntityId);
    if (!found) {
      showStatus('Select an entity first.');
      return;
    }
    const template = dom.entityTemplateSelect.value;
    if (!template) return;
    withPersist(() => {
      if (template === 'crudAggregate') {
        ensureForeignKeyField(found.entity, 'owner');
      }
      if (template === 'eventSourced') {
        const hasVersion = found.entity.fields.some((field) => normalizedName(field.name) === 'version');
        if (!hasVersion) found.entity.fields.push(normalizeField({ name: 'version', type: 'integer', required: true }, found.entity.fields.length));
        found.entity.meta.aggregateRoot = true;
      }
      if (template === 'referenceData') {
        const hasCode = found.entity.fields.some((field) => normalizedName(field.name) === 'code');
        if (!hasCode) found.entity.fields.push(normalizeField({ name: 'code', type: 'string', required: true, unique: true }, found.entity.fields.length));
      }
      if (template === 'tenantOwned') {
        ensureForeignKeyField(found.entity, 'tenant');
      }
      render();
    });
  };
  dom.entityNameInput.onkeydown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    dom.addEntityBtn.click();
  };

  dom.renameEntityBtn.onclick = () => {
    saveSelectedEntityName(dom.entityRenameInput.value);
  };
  dom.duplicateEntityBtn.onclick = duplicateSelectedEntity;

  dom.deleteEntityBtn.onclick = () => {
    const found = findEntity(state.selectedEntityId);
    if (!found) return;
    if (!window.confirm(`Delete entity "${found.entity.name}" and related links?`)) return;
    withPersist(() => {
      deleteEntity(found.entity.id);
      render();
    });
  };
  dom.entitySearchBtn.onclick = () => {
    const search = dom.entitySearchInput.value.trim();
    if (!search) return;
    const found = findEntityByName(search);
    if (!found) {
      showStatus(`No entity found for "${search}".`);
      return;
    }
    focusEntity(found.entity.id);
  };
  dom.entitySearchInput.onkeydown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    dom.entitySearchBtn.click();
  };
  dom.saveEntityRenameBtn.onclick = () => saveSelectedEntityName(dom.entityRenameInput.value);
  dom.saveEntityRulesBtn.onclick = saveSelectedEntityRules;
  dom.saveEntityRbacBtn.onclick = saveSelectedEntityRbacRule;
  dom.entityRbacActionSelect.onchange = () => {
    const found = findEntity(state.selectedEntityId);
    if (!found) return;
    inspectors.renderEntityRbacInspector(found.entity);
  };
  // The tenant-scope checkbox is read-only and previews the value derived
  // from the currently checked roles (JUM-477).
  [dom.entityRbacSuperadminCheck, dom.entityRbacAdminCheck, dom.entityRbacUserCheck].forEach((check) => {
    check.onchange = () => {
      const roles = [];
      if (dom.entityRbacSuperadminCheck.checked) roles.push('superadmin');
      if (dom.entityRbacAdminCheck.checked) roles.push('admin');
      if (dom.entityRbacUserCheck.checked) roles.push('user');
      dom.entityRbacTenantCheck.checked = deriveTenantScoped(roles);
    };
  });
  dom.addEntityContractBtn.onclick = addSelectedEntityContract;
  dom.saveEntityOasCompositionBtn.onclick = saveSelectedEntityOasComposition;
  dom.entityRenameInput.onkeydown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    dom.saveEntityRenameBtn.click();
  };
  dom.moveEntityBtn.onclick = () => moveSelectedEntityToDomain(dom.entityMoveDomainSelect.value);

  dom.addRelationshipBtn.onclick = () => {
    addRelationship(
      dom.fromEntitySelect.value,
      dom.toEntitySelect.value,
      dom.fromCardSelect.value,
      dom.toCardSelect.value
    );
  };
  dom.pickRelationshipBtn.onclick = () => {
    setRelationshipPickMode(!interaction.relationshipPickActive);
  };
  dom.saveRelationshipBtn.onclick = saveSelectedRelationship;
  dom.reverseRelationshipBtn.onclick = reverseSelectedRelationship;
  dom.resetRelationshipLabelOffsetBtn.onclick = () => {
    if (!state.selectedRelationshipId) return;
    dom.relationshipLabelOffsetXInput.value = '0';
    dom.relationshipLabelOffsetYInput.value = '0';
    dom.relationshipBendXInput.value = '';
    dom.relationshipBendYInput.value = '';
    dom.relationshipAnchorBehaviorSelect.value = 'auto';
    saveSelectedRelationship();
  };
  dom.undoBtn.onclick = undo;
  dom.redoBtn.onclick = redo;
  dom.zoomInBtn.onclick = () => canvas.zoomBy(0.1);
  dom.zoomOutBtn.onclick = () => canvas.zoomBy(-0.1);
  dom.edgeStyleSelect.onchange = () => {
    const value = dom.edgeStyleSelect.value;
    if (!['curved', 'orthogonal'].includes(value)) return;
    withPersist(() => {
      state.view.edgeStyle = value;
      render();
    }, { recordHistory: false });
  };
  dom.toggleCompactViewBtn.onclick = canvas.toggleCompactView;
  dom.toggleSnapBtn.onclick = () => {
    withPersist(() => {
      state.view.snapToGrid = !state.view.snapToGrid;
      canvas.renderView();
    }, { recordHistory: false });
  };
  dom.toggleLargeCanvasBtn.onclick = () => {
    withPersist(() => {
      state.view.largeCanvasMode = !state.view.largeCanvasMode;
      if (state.view.largeCanvasMode) state.view.compactEntities = true;
      render();
    }, { recordHistory: false });
  };
  dom.runModelCheckBtn.onclick = runModelChecks;
  dom.modelCheckMinSeveritySelect.onchange = () => {
    withPersist(() => {
      state.view.modelCheckMinSeverity = dom.modelCheckMinSeveritySelect.value;
      inspectors.renderModelCheckResults(collectModelIssues(state));
    }, { recordHistory: false });
  };
  dom.exportBlockCriticalCheck.onchange = () => {
    withPersist(() => {
      state.view.exportBlockCritical = Boolean(dom.exportBlockCriticalCheck.checked);
      canvas.renderView();
    }, { recordHistory: false });
  };
  dom.saveBaselineBtn.onclick = saveSchemaBaseline;
  dom.runSchemaDiffBtn.onclick = runSchemaDiff;
  dom.clearBaselineBtn.onclick = () => {
    store.clearBaseline();
    inspectors.renderSchemaDiffResults([{ severity: 'info', message: 'Baseline cleared.' }]);
  };
  dom.autoLayoutBtn.onclick = canvas.autoLayout;
  dom.fitViewBtn.onclick = canvas.fitView;
  dom.resetViewBtn.onclick = canvas.resetView;

  dom.addFieldBtn.onclick = addFieldToSelectedEntity;
  dom.applyFieldTemplateBtn.onclick = applyFieldTemplateToSelectedEntity;
  dom.fieldNameInput.onkeydown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    dom.addFieldBtn.click();
  };
  dom.exportJsonBtn.onclick = exportAsJson;
  dom.exportOasBtn.onclick = exportAsOas;
  dom.exportMdBtn.onclick = exportAsMarkdown;
  dom.exportJsonschemaBtn.onclick = exportAsJsonSchema;
  dom.exportAsyncapiBtn.onclick = exportAsAsyncApi;
  dom.exportProtoBtn.onclick = exportAsProto;
  dom.exportBoilerplateBundleBtn.onclick = exportBoilerplateBundle;
  dom.exportPackageBtn.onclick = exportAsPackage;
  dom.generateCodePreviewBtn.onclick = generateCodePreview;
  dom.generateExamplesBtn.onclick = generateExamplesPreview;
  dom.importJsonBtn.onclick = () => dom.importJsonInput.click();
  dom.importJsonInput.onchange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    importStateFromFile(file);
    dom.importJsonInput.value = '';
  };
  dom.importOasBtn.onclick = () => dom.importOasInput.click();
  dom.importOasInput.onchange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    importStateFromOasFile(file);
    dom.importOasInput.value = '';
  };
  dom.importPackageBtn.onclick = () => dom.importPackageInput.click();
  dom.importPackageInput.onchange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    importDomainPackage(file);
    dom.importPackageInput.value = '';
  };

  // JUM-548: the sample loader is reachable from the Export panel (always)
  // and from the Domain Designer's guided empty state (the first action).
  if (dom.loadSampleBtn) dom.loadSampleBtn.onclick = () => loadSampleModel();
  if (dom.loadSampleEmptyBtn) dom.loadSampleEmptyBtn.onclick = () => loadSampleModel();

  dom.resetCanvasBtn.onclick = () => {
    if (!window.confirm('Reset canvas? All domains and relationships will be cleared.')) return;
    withPersist(() => {
      seed();
      render();
    });
  };

  dom.clearStorageBtn.onclick = () => {
    store.clear();
    showStatus('Saved designer state cleared.', 'info');
  };

  // Canvas-level listeners (background click, wheel zoom, pan, anchor-drag
  // preview) are wired by the canvas module.
  canvas.wireCanvasEvents();

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const targetTag = String(event.target?.tagName || '').toLowerCase();
    const editingInput = ['input', 'textarea', 'select'].includes(targetTag);
    if (event.code === 'Space') {
      // Space on a focused control keeps its native activation (JUM-488) —
      // the pan modifier only engages from non-interactive targets, so a
      // keyboard user can still operate every button with Space.
      if (editingInput || ['button', 'a'].includes(targetTag)) return;
      event.preventDefault();
      interaction.spacePressed = true;
      dom.canvas.classList.add('space-mode');
      return;
    }
    if (key === 'escape') {
      setRelationshipPickMode(false);
      canvas.stopAnchorDrag();
      state.selectedRelationshipId = null;
      render();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault();
      redo();
      return;
    }
    if (event.altKey && key === 'l') {
      event.preventDefault();
      canvas.autoLayout();
      return;
    }
    if (event.altKey && key === 'r') {
      event.preventDefault();
      startRelationshipPickFromSelectedEntity();
      return;
    }
    if (event.altKey && key === 'v') {
      event.preventDefault();
      canvas.toggleCompactView();
      return;
    }
    if (!editingInput && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && state.selectedEntityId) {
      const found = findEntity(state.selectedEntityId);
      if (!found) return;
      const step = event.shiftKey ? 16 : 8;
      const maxX = 520 - 200;
      const maxY = 180;
      withPersist(() => {
        if (key === 'arrowleft') found.entity.x = Math.max(8, snapCoordinate(found.entity.x - step));
        if (key === 'arrowright') found.entity.x = Math.min(maxX, snapCoordinate(found.entity.x + step));
        if (key === 'arrowup') found.entity.y = Math.max(8, snapCoordinate(found.entity.y - step));
        if (key === 'arrowdown') found.entity.y = Math.min(maxY, snapCoordinate(found.entity.y + step));
        render();
      });
      event.preventDefault();
      return;
    }
    if ((key === 'delete' || key === 'backspace') && state.selectedRelationshipId) {
      if (editingInput) return;
      event.preventDefault();
      deleteRelationship(state.selectedRelationshipId);
      return;
    }
    if ((key === 'delete' || key === 'backspace') && state.selectedEntityId) {
      if (editingInput) return;
      const found = findEntity(state.selectedEntityId);
      if (!found) return;
      const ok = window.confirm(`Delete entity "${found.entity.name}" and related links?`);
      if (!ok) return;
      event.preventDefault();
      deleteEntity(found.entity.id);
      render();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.code !== 'Space') return;
    interaction.spacePressed = false;
    dom.canvas.classList.remove('space-mode');
  });
}

// Pre-migration backup download (JUM-484): the verbatim localStorage payload,
// offered as a file BEFORE anything is written to Cana — the recourse that
// replaces the retired fallback.
function downloadMigrationBackup(fileName, rawJson) {
  const blob = new Blob([rawJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Boot is async because the IDesignerStore port is async (Cana crosses a
// worker boundary). Order: one-way migration → declared storage-environment
// state → load → wire → render.
async function boot() {
  // JUM-484: one-way migration localStorage → Cana, before any state load so
  // a migrated payload is read from Cana on this very boot. The source stays
  // in localStorage, unused, for the declared retention period; nothing ever
  // falls back to it (decision 2026-07-29).
  const migration = await migrateLocalStorageToCana({
    store,
    downloadBackup: downloadMigrationBackup
  });
  if (migration.status === 'migrated') {
    showStatus(
      'Your saved design was moved to the new persistent store and verified. '
      + `A backup was downloaded as ${migration.backupFileName}; the previous copy stays, unused, `
      + `for ${CANA_MIGRATION_SOURCE_RETENTION_DAYS} days as a manual recovery path.`,
      'info'
    );
  } else if (migration.status === 'failed') {
    showStatus(`Your previously saved design could not be migrated: ${migration.reason}`, 'error');
  }

  // Declared storage-environment states (JUM-484): private/incognito browsing,
  // unsupported browsers and lost data are detected and communicated through
  // the status region — never a silent in-memory session. On a boot that
  // migrated (or failed to), that message names the more specific cause and
  // wins the single region; the environment states recur on later boots.
  if (migration.status === 'already-migrated' || migration.status === 'no-source') {
    const probe = await store.probe();
    const environment = describeDesignerStorageEnvironment({
      indexedDbPresent: typeof indexedDB !== 'undefined',
      probeStatus: probe.status,
      probeReason: probe.reason
    });
    if (environment.message) showStatus(environment.message, environment.severity);
  }

  await loadState();
  wireEvents();
  render();

  // JUM-485: multi-tab sync starts only after the initial load — the boot
  // load IS this tab's resume from whatever happened while it was closed.
  // Starting earlier would apply remote events on top of an empty state.
  designerSync = createDesignerSync({
    store,
    designerState,
    render: renderPreservingInteraction,
    notify: showStatus
  });
  designerSync.start().catch((error) => {
    showStatus(`Multi-tab sync could not start: ${error instanceof Error ? error.message : String(error)}`, 'error');
  });
  // A backgrounded tab can miss channel messages (frozen pages queue nothing);
  // on return it catches up by document read-back — no loss, no duplication.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && designerSync) {
      designerSync.resume().catch(() => {});
    }
  });
  window.addEventListener('pagehide', () => {
    if (designerSync) designerSync.stop();
  });
  // A page restored from the back/forward cache was stopped at pagehide;
  // restarting re-runs the cursor resume/resync path inside start().
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && designerSync) {
      designerSync.start().catch(() => {});
    }
  });

  loadRuntimeEnvironment(state.runtimeEnvironment?.environment || 'dev')
    .catch((error) => {
      renderRuntimeEnvironment();
      // Boot-time load failure is not silent (JUM-543): the panel's inline
      // status line carries the cause the API returned.
      showRuntimeEnvStatus(error instanceof Error ? error.message : 'Could not load runtime environment.');
    });
  // Boot-time PM2 preview load (JUM-480): the runtime profile pane reads the
  // real ecosystem of the selected preview environment; a failure lands in
  // the pane and its status line, never silently.
  loadPm2EcosystemPreview(dom.pm2PreviewEnvironmentSelect?.value || 'dev')
    .catch((error) => failPm2EcosystemPreview(dom.pm2PreviewEnvironmentSelect?.value || 'dev', error));
}

boot();
