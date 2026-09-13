/**
 * controlHelp — keyboard/touch reachable help for the Service Management UI.
 *
 * Static titles were not enough for JUM-733: browser tooltips do not work on
 * touch and are not a reliable keyboard affordance. This module adds accessible
 * descriptions to every static control and only renders a small visual help
 * button where doing so will not change dense grids, tablists, or editor hosts.
 */

const EXEMPT_IDS = new Set([
  'import-json-input',
  'import-oas-input',
  'import-package-input'
]);

const TAB_HELP = 'Switches the active work area without changing the current model.';
const VISUAL_HELP_HOST_BLOCKLIST = '.row, [role="tablist"], .code-editor-body, .entity, .mini-map, .canvas-context-menu';
const OBSERVED_UI_REGIONS = [
  '.sidebar',
  '.canvas-toolbar',
  '.tab-body:not(.monitoring-dashboard)',
  '.monitoring-dashboard',
  '.code-explorer',
  '.code-editor-titlebar'
];

const SPECIFIC_HELP = {
  'tab-domain-designer-btn': ['Domain Designer', 'Model domains, entities, fields, relationships and exportable contracts.'],
  'tab-interface-designer-btn': ['Communication Interface Designer', 'Define inbound adapters and their controller mappings.'],
  'tab-service-config-btn': ['Service Configuration', 'Set the runtime profile used by generated services and local PM2 previews.'],
  'tab-deploy-management-btn': ['Deploy Management', 'Describe where the generated service can run and which runtime/profile applies.'],
  'tab-monitoring-btn': ['Monitoring', 'Open the PM2 dashboard fed by the local runtime stream.'],
  'tab-code-workspace-btn': ['Code Workspace', 'Inspect and edit generated source files while preserving regeneration conflicts.'],
  'sidebar-group-model-btn': ['Model Panels', TAB_HELP],
  'sidebar-group-inspector-btn': ['Inspector Panels', TAB_HELP],
  'sidebar-group-quality-btn': ['Quality Panels', TAB_HELP],
  'sidebar-group-share-btn': ['Share Panels', TAB_HELP],
  'domain-name-input': ['Domain Name', 'Names the bounded context. It appears in exported schemas, packages and generated module names.'],
  'add-domain-btn': ['Add Domain', 'Creates a new bounded context on the canvas.'],
  'rename-domain-btn': ['Rename Domain', 'Renames the selected domain while preserving its entities and relationships.'],
  'delete-domain-btn': ['Delete Domain', 'Deletes the selected domain and its contained model elements.'],
  'domain-color-input': ['Domain Color', 'Sets the visual color used to identify the selected domain.'],
  'set-domain-color-btn': ['Set Color', 'Applies the selected color to the current domain.'],
  'domain-ubiquitous-language-input': ['Ubiquitous Language', 'Captures the language and terms the team uses for this bounded context.'],
  'domain-owner-team-input': ['Owner Team', 'Records the team accountable for this domain and its generated contracts.'],
  'domain-upstream-input': ['Upstream Dependencies', 'Lists domains or services this domain depends on.'],
  'domain-downstream-input': ['Downstream Dependencies', 'Lists consumers that depend on this domain.'],
  'domain-integration-channel-input': ['Integration Channel', 'Documents the primary integration style, such as HTTP, async messaging or gRPC.'],
  'domain-package-dependencies-input': ['Package Dependencies', 'Declares domain package dependencies used by package import/export checks.'],
  'domain-shared-value-objects-input': ['Shared Value Objects', 'Lists reusable value objects shared with other domains.'],
  'save-domain-context-btn': ['Save Context', 'Persists the selected domain metadata into the model document.'],
  'clear-domain-context-btn': ['Clear Context', 'Clears optional metadata from the selected domain.'],
  'entity-name-input': ['Entity Name', 'Names an entity inside the selected domain.'],
  'add-entity-btn': ['Add Entity', 'Creates an entity in the selected domain.'],
  'entity-template-select': ['Entity Template', 'Chooses a starter shape such as aggregate, tenant-owned or reference data.'],
  'apply-entity-template-btn': ['Apply Entity Template', 'Adds fields and metadata from the selected entity template.'],
  'rename-entity-btn': ['Rename Entity', 'Renames the selected entity and keeps its model identity.'],
  'delete-entity-btn': ['Delete Entity', 'Deletes the selected entity and invalid relationships.'],
  'duplicate-entity-btn': ['Duplicate Entity', 'Copies the selected entity as an independent editable entity.'],
  'entity-search-input': ['Entity Search', 'Finds an entity by name inside the current model.'],
  'entity-search-btn': ['Find Entity', 'Selects the first entity matching the search text.'],
  'from-entity-select': ['Relationship Source', 'Chooses the entity where a new relationship starts.'],
  'from-card-select': ['Source Cardinality', 'Defines whether the source side is one or many.'],
  'to-card-select': ['Target Cardinality', 'Defines whether the target side is one or many.'],
  'to-entity-select': ['Relationship Target', 'Chooses the entity where a new relationship ends.'],
  'relationship-auto-fk-check': ['Auto Foreign Key', 'When enabled, the designer adds the expected foreign-key field for the relationship.'],
  'add-relationship-btn': ['Connect', 'Creates a relationship using the selected entities and cardinalities.'],
  'pick-relationship-btn': ['Pick On Canvas', 'Lets you create the relationship by choosing endpoints directly on the diagram.'],
  'relationship-name-input': ['Relationship Name', 'Labels the selected relationship for readers and exports.'],
  'relationship-from-entity-select': ['Edit Source Entity', 'Changes the selected relationship source.'],
  'relationship-to-entity-select': ['Edit Target Entity', 'Changes the selected relationship target.'],
  'relationship-from-card-select': ['Edit Source Cardinality', 'Changes cardinality at the source side.'],
  'relationship-to-card-select': ['Edit Target Cardinality', 'Changes cardinality at the target side.'],
  'save-relationship-btn': ['Save Relationship', 'Applies relationship endpoint, cardinality, label and route edits.'],
  'reverse-relationship-btn': ['Reverse Relationship', 'Swaps relationship direction while preserving its meaning.'],
  'relationship-label-offset-x-input': ['Label X Offset', 'Moves the relationship label horizontally from the route midpoint.'],
  'relationship-label-offset-y-input': ['Label Y Offset', 'Moves the relationship label vertically from the route midpoint.'],
  'reset-relationship-label-offset-btn': ['Reset Label Position', 'Returns the relationship label to the geometric midpoint.'],
  'relationship-bend-x-input': ['Bend X', 'Sets the explicit horizontal bend point for a relationship route.'],
  'relationship-bend-y-input': ['Bend Y', 'Sets the explicit vertical bend point for a relationship route.'],
  'relationship-anchor-behavior-select': ['Anchor Behavior', 'Chooses automatic field-aware anchors or center anchors.'],
  'entity-rename-input': ['Entity Inspector Name', 'Edits the selected entity name from the inspector.'],
  'save-entity-rename-btn': ['Save Entity Name', 'Persists the inspector entity name edit.'],
  'entity-move-domain-select': ['Move To Domain', 'Chooses the destination domain for the selected entity.'],
  'move-entity-btn': ['Move Domain', 'Moves the selected entity while preserving supported relationships.'],
  'entity-aggregate-root-check': ['Aggregate Root', 'Marks the entity as the root of its aggregate boundary.'],
  'entity-invariants-input': ['Invariant Rules', 'Documents business rules that generated use cases must respect.'],
  'save-entity-rules-btn': ['Save Rules', 'Persists aggregate-root and invariant changes.'],
  'entity-rbac-action-select': ['RBAC Action', 'Selects which operation policy is being edited.'],
  'entity-rbac-superadmin-check': ['Superadmin Role', 'Allows the selected operation for superadmins.'],
  'entity-rbac-admin-check': ['Admin Role', 'Allows the selected operation for tenant admins.'],
  'entity-rbac-user-check': ['User Role', 'Allows the selected operation for regular users.'],
  'entity-rbac-tenant-check': ['Tenant Scoped', 'Shows derived tenant scoping for the selected RBAC roles.'],
  'save-entity-rbac-btn': ['Save RBAC Rule', 'Persists the selected role policy for this entity operation.'],
  'entity-contract-name-input': ['Message Contract Name', 'Names an event, command, request or response contract.'],
  'entity-contract-type-select': ['Message Contract Type', 'Chooses the message contract kind.'],
  'entity-contract-channel-input': ['Message Channel', 'Defines the topic, queue or channel name used by the contract.'],
  'entity-contract-version-input': ['Message Version', 'Pins the semantic version of this message contract.'],
  'add-entity-contract-btn': ['Add Contract', 'Adds the message contract to the selected entity.'],
  'entity-oas-composition-mode-select': ['OpenAPI Composition Mode', 'Chooses oneOf, allOf, anyOf, or no schema composition.'],
  'entity-oas-composition-refs-input': ['Composition Refs', 'Lists internal schema references included in the composition.'],
  'entity-oas-external-refs-input': ['External Refs', 'Lists external schema references included in the composition.'],
  'entity-oas-discriminator-input': ['Discriminator Property', 'Sets the OpenAPI discriminator field used by composed schemas.'],
  'save-entity-oas-composition-btn': ['Save OAS Composition', 'Persists the selected entity OpenAPI composition metadata.'],
  'field-name-input': ['Field Name', 'Names a field; invalid identifier-shaped names are refused before export.'],
  'add-field-btn': ['Add Field', 'Adds a field to the selected entity with the configured type and flags.'],
  'field-template-select': ['Field Template', 'Chooses a reusable field group such as tenant, audit or contact fields.'],
  'apply-field-template-btn': ['Apply Field Template', 'Adds the selected field template to the entity.'],
  'field-type-select': ['Field Type', 'Chooses the OpenAPI/JSON Schema type used by exports and codegen.'],
  'field-format-select': ['Field Format', 'Adds an OpenAPI format hint such as uuid, email or date-time.'],
  'field-enum-input': ['Enum Values', 'Defines the allowed enum values as a comma-separated list.'],
  'field-required-check': ['Required Field', 'Marks the field as required in generated schemas.'],
  'field-pk-check': ['Primary Key', 'Marks the field as part of the entity identity.'],
  'field-fk-check': ['Foreign Key', 'Marks the field as referencing another entity.'],
  'field-unique-check': ['Unique Field', 'Marks the field as uniquely constrained.'],
  'field-nullable-check': ['Nullable Field', 'Allows the field value to be null.'],
  'export-json-btn': ['Export JSON', 'Downloads the complete Service Management model document.'],
  'export-oas-btn': ['Export OAS 3.1', 'Downloads the OpenAPI 3.1 document generated from the model.'],
  'export-md-btn': ['Export Markdown', 'Downloads a human-readable domain model report.'],
  'export-jsonschema-btn': ['Export JSON Schema', 'Downloads draft 2020-12 JSON Schemas.'],
  'export-asyncapi-btn': ['Export AsyncAPI', 'Downloads AsyncAPI contracts generated from message metadata.'],
  'export-proto-btn': ['Export gRPC Proto', 'Downloads a proto view of message contracts.'],
  'export-boilerplate-bundle-btn': ['Export Boilerplate Bundle', 'Downloads generated source files, including Code Workspace edits.'],
  'export-package-btn': ['Export Package', 'Downloads the selected domain as a reusable package.'],
  'import-json-btn': ['Import JSON', 'Imports a full Service Management JSON document.'],
  'import-oas-btn': ['Import OAS 3.1', 'Imports domains and entities from an OpenAPI document.'],
  'import-package-btn': ['Import Package', 'Imports a reusable domain package with merge safeguards.'],
  'load-sample-btn': ['Load Sample Model', 'Loads the guided sample model used for first-run exploration.'],
  'generate-code-preview-btn': ['Code Preview', 'Renders generated TypeScript files for the selected model.'],
  'generate-examples-btn': ['Generate Examples', 'Builds request and response examples from entity schemas.'],
  'reset-canvas-btn': ['Reset Model', 'Resets the working model to the default state.'],
  'clear-storage-btn': ['Clear Save', 'Clears the persisted designer state from local storage.'],
  'undo-btn': ['Undo', 'Reverts the previous model edit.'],
  'redo-btn': ['Redo', 'Reapplies the next model edit after undo.'],
  'run-model-check-btn': ['Validate Model', 'Runs the export-quality checks for the current model.'],
  'export-block-critical-check': ['Block Critical Exports', 'Prevents exports while blocking model issues exist.'],
  'model-check-min-severity-select': ['Minimum Severity', 'Filters the visible model-check issue list.'],
  'save-baseline-btn': ['Save Baseline', 'Stores the current model as the schema-diff baseline.'],
  'run-schema-diff-btn': ['Run Diff', 'Compares the current model with the saved baseline.'],
  'clear-baseline-btn': ['Clear Baseline', 'Deletes the saved schema-diff baseline.'],
  'domain-designer-empty-load-sample-btn': ['Load Sample Model', 'Starts first-run exploration with a safe sample model.'],
  'toggle-sidebar-btn': ['Panels', 'Opens or closes the Domain Designer panel drawer.'],
  'quick-add-domain-btn': ['Quick Add Domain', 'Creates a domain directly from the canvas toolbar.'],
  'quick-add-entity-btn': ['Quick Add Entity', 'Creates an entity in the selected domain from the canvas toolbar.'],
  'quick-undo-btn': ['Quick Undo', 'Reverts the last model edit from the toolbar.'],
  'quick-redo-btn': ['Quick Redo', 'Reapplies an undone model edit from the toolbar.'],
  'quick-add-note-btn': ['Add Note', 'Places a non-exported note on the diagram.'],
  'quick-validate-btn': ['Quick Validate', 'Runs the model check without opening the drawer.'],
  'export-png-btn': ['Export PNG', 'Downloads a readable PNG snapshot of the diagram.'],
  'model-search-input': ['Model Search', 'Searches domains, entities, field names and field types.'],
  'zoom-out-btn': ['Zoom Out', 'Reduces canvas zoom around the current viewport.'],
  'zoom-in-btn': ['Zoom In', 'Increases canvas zoom around the current viewport.'],
  'edge-style-select': ['Relationship Routing', 'Switches between curved and orthogonal relationship routes.'],
  'toggle-compact-view-btn': ['Compact View', 'Toggles dense entity rendering for larger models.'],
  'toggle-snap-btn': ['Snap', 'Toggles grid snapping while dragging model elements.'],
  'auto-layout-btn': ['Auto Layout', 'Distributes domains and entities to reduce overlap.'],
  'toggle-large-canvas-btn': ['Large Canvas', 'Switches to a larger workspace for bigger diagrams.'],
  'fit-view-btn': ['Fit View', 'Frames the current diagram in the canvas viewport.'],
  'reset-view-btn': ['Reset View', 'Returns pan and zoom to the default view.'],
  'interface-type-select': ['Interface Type', 'Chooses HTTP, gRPC, WebSocket or SSE adapter type.'],
  'interface-framework-select': ['Framework Runtime', 'Chooses a framework compatible with the selected adapter type.'],
  'interface-entrypoint-input': ['Entrypoint', 'Defines the generated adapter entrypoint path.'],
  'interface-controller-input': ['Controller Mapping', 'Maps the adapter to a generated controller operation.'],
  'add-interface-adapter-btn': ['Add Adapter', 'Registers the configured inbound adapter.'],
  'service-kind-select': ['Service Kind', 'Selects the service shape such as REST API or WebSocket plus REST.'],
  'run-mode-select': ['Run Mode', 'Chooses managed, serverless or static hosting behavior.'],
  'cloud-provider-select': ['Cloud Provider', 'Chooses the target platform for runtime constraints.'],
  'service-static-assets-input': ['Static Assets', 'Sets the optional static assets path for static-serving profiles.'],
  'save-service-config-btn': ['Save Profile', 'Validates and saves the runtime service profile.'],
  'service-http-port-input': ['HTTP Port', 'Sets the local HTTP port for REST adapters.'],
  'service-websocket-port-input': ['WebSocket Port', 'Sets the local WebSocket port.'],
  'service-grpc-port-input': ['gRPC Port', 'Sets the local gRPC port.'],
  'pm2-preview-environment-select': ['PM2 Preview Environment', 'Chooses which ecosystem file feeds the runtime preview.'],
  'runtime-env-select': ['Runtime Environment', 'Chooses which environment file to load or save.'],
  'runtime-env-refresh-btn': ['Refresh Environment', 'Reloads runtime environment values from disk.'],
  'runtime-env-save-btn': ['Save Environment', 'Writes editable runtime environment values back to the selected file.'],
  'deploy-name-input': ['Deploy Target Name', 'Names a deployment target.'],
  'deploy-type-select': ['Deploy Target Type', 'Chooses the deployment provider or self-hosted target.'],
  'deploy-service-type-select': ['Deploy Service Type', 'Chooses the deployed workload class.'],
  'deploy-runtime-protocol-select': ['Runtime Protocol', 'Chooses the protocol exposed by the target.'],
  'deploy-database-driver-select': ['Database Driver', 'Chooses the database driver expected in that deployment.'],
  'deploy-keyvalue-driver-select': ['Key-Value Driver', 'Chooses the key-value driver for the deployment.'],
  'deploy-pm2-profile-select': ['PM2 Profile', 'Chooses the PM2 profile for VM-based targets.'],
  'deploy-region-input': ['Deploy Region', 'Sets the cloud/self-hosted region label.'],
  'deploy-runtime-input': ['Deploy Runtime', 'Sets the runtime/version value such as nodejs22.x.'],
  'add-deploy-target-btn': ['Add Deploy Target', 'Validates and saves the deployment target.'],
  'cancel-deploy-target-edit-btn': ['Cancel Edit', 'Leaves deploy-target edit mode without saving.'],
  'pm2-metrics-environment-select': ['Metrics Environment', 'Chooses which PM2 ecosystem the monitoring stream tracks.'],
  'pm2-interval-select': ['Metrics Interval', 'Chooses how frequently PM2 metrics are sampled.'],
  'pm2-filter-query': ['Process Filter', 'Filters processes by name, script or namespace.'],
  'pm2-filter-status': ['Status Filter', 'Filters the PM2 process table by status.'],
  'pm2-filter-namespace': ['Namespace Filter', 'Filters the PM2 process table by namespace.'],
  'pm2-filter-expected-only': ['Expected Only', 'Shows only processes declared by the selected ecosystem.'],
  'pm2-filter-missing-only': ['Missing Only', 'Shows only expected processes missing from PM2.'],
  'pm2-namespace-ops-select': ['Namespace Operations', 'Chooses which namespace bulk PM2 actions target.'],
  'pm2-ns-start-btn': ['Start Namespace', 'Starts all eligible processes in the selected namespace.'],
  'pm2-ns-stop-btn': ['Stop Namespace', 'Stops all eligible processes in the selected namespace while protecting the console itself.'],
  'pm2-ns-restart-btn': ['Restart Namespace', 'Restarts all eligible processes in the selected namespace.'],
  'code-workspace-regenerate-btn': ['Regenerate', 'Rebuilds generated files and marks conflicting edits as stale.'],
  'code-workspace-keep-mine-btn': ['Keep Mine', 'Keeps your edited file content when regeneration conflicts.'],
  'code-workspace-take-generated-btn': ['Take Generated', 'Replaces the active file with regenerated content.'],
  'code-workspace-search-input': ['File Filter', 'Filters generated files in the explorer tree.'],
  'code-workspace-close-tab-btn': ['Close File', 'Closes the active generated-code tab.'],
  'code-workspace-editor': ['Generated Code Editor', 'Edits the active generated file; changes are persisted as an overlay.']
};

function humanizeId(id) {
  return String(id || '')
    .replace(/-(btn|input|select|check|textarea)$/u, '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function controlText(control) {
  const labelledBy = control.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy.split(/\s+/u)
      .map((id) => control.ownerDocument.getElementById(id)?.textContent?.trim() || '')
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }
  return control.getAttribute('aria-label')
    || control.getAttribute('title')
    || control.getAttribute('placeholder')
    || control.textContent?.trim()
    || humanizeId(control.id);
}

export function describeControlHelp(control) {
  const explicit = SPECIFIC_HELP[control?.id];
  if (explicit) return { title: explicit[0], body: explicit[1] };
  const title = controlText(control);
  const role = control?.tagName === 'SELECT'
    ? 'Choose the value used by this Service Management workflow.'
    : control?.tagName === 'TEXTAREA'
      ? 'Edit the multi-line value used by this Service Management workflow.'
      : control?.type === 'checkbox'
        ? 'Toggle this option for the current workflow.'
        : control?.tagName === 'BUTTON'
          ? 'Runs this action for the current Service Management workflow.'
          : 'Edit the value used by this Service Management workflow.';
  return { title, body: role };
}

function controlHelpKey(control) {
  return `control-help-${control.id}`;
}

function shouldInstallHelp(control) {
  if (!control?.id || EXEMPT_IDS.has(control.id)) return false;
  if (control.classList?.contains('control-help-btn')) return false;
  if (control.dataset?.controlHelp === 'false') return false;
  if (control.hidden || control.type === 'hidden') return false;
  if (control.closest?.('.entity, .mini-map, .canvas-context-menu')) return false;
  return true;
}

function shouldInstallVisualHelp(control) {
  if (control.id === 'code-workspace-editor') return false;
  return !control.closest?.(VISUAL_HELP_HOST_BLOCKLIST);
}

function insertAfterControl(control, button) {
  const checkboxLabel = control.closest('label.check');
  if (checkboxLabel?.parentNode) {
    checkboxLabel.insertAdjacentElement('afterend', button);
    return;
  }
  control.insertAdjacentElement('afterend', button);
}

function closeAll(rootDocument) {
  const root = rootDocument.body || rootDocument;
  root.querySelectorAll('.control-help-btn[aria-expanded="true"]').forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
  });
  rootDocument.getElementById('control-help-popover')?.setAttribute('hidden', '');
}

function ensureDescription(control, help, rootDocument) {
  const key = controlHelpKey(control);
  if (!rootDocument.getElementById(key)) {
    const description = rootDocument.createElement('span');
    description.id = key;
    description.className = 'control-help-description';
    description.textContent = `${help.title}. ${help.body}`;
    rootDocument.body.appendChild(description);
  }
  const currentDescription = control.getAttribute('aria-describedby');
  const describedBy = new Set((currentDescription || '').split(/\s+/u).filter(Boolean));
  describedBy.add(key);
  control.setAttribute('aria-describedby', [...describedBy].join(' '));
}

function ensurePopover(rootDocument) {
  const existing = rootDocument.getElementById('control-help-popover');
  if (existing) return existing;
  const popover = rootDocument.createElement('div');
  popover.id = 'control-help-popover';
  popover.className = 'control-help-popover';
  popover.setAttribute('role', 'tooltip');
  popover.setAttribute('aria-live', 'polite');
  popover.setAttribute('hidden', '');
  popover.innerHTML = '<strong></strong><span></span>';
  rootDocument.body.appendChild(popover);
  return popover;
}

function placePopover(popover, button) {
  const viewport = button.ownerDocument.defaultView;
  if (!viewport) return;
  const margin = 10;
  const rect = button.getBoundingClientRect();
  popover.removeAttribute('hidden');
  popover.style.left = '0';
  popover.style.top = '0';
  const popoverRect = popover.getBoundingClientRect();
  const left = Math.min(
    Math.max(rect.left + (rect.width / 2) - (popoverRect.width / 2), margin),
    viewport.innerWidth - popoverRect.width - margin
  );
  const below = rect.bottom + 8;
  const above = rect.top - popoverRect.height - 8;
  const top = below + popoverRect.height + margin <= viewport.innerHeight
    ? below
    : Math.max(above, margin);
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function scheduleScan(rootDocument) {
  const root = rootDocument.body || rootDocument;
  if (root.dataset.controlHelpScanQueued === 'true') return;
  root.dataset.controlHelpScanQueued = 'true';
  const schedule = rootDocument.defaultView?.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
  schedule(() => {
    root.dataset.controlHelpScanQueued = 'false';
    installControlHelp(rootDocument);
  });
}

export function installControlHelp(rootDocument = document) {
  const root = rootDocument.body || rootDocument;
  const controls = [...root.querySelectorAll('button[id], input[id], select[id], textarea[id]')]
    .filter(shouldInstallHelp);
  controls.forEach((control) => {
    const key = controlHelpKey(control);
    const help = describeControlHelp(control);
    ensureDescription(control, help, rootDocument);
    if (!shouldInstallVisualHelp(control)) return;
    if (rootDocument.getElementById(`${key}-btn`)) return;
    const button = rootDocument.createElement('button');
    button.id = `${key}-btn`;
    button.type = 'button';
    button.className = 'control-help-btn';
    button.setAttribute('aria-label', `Help: ${help.title}`);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'control-help-popover');
    button.setAttribute('aria-describedby', key);
    button.textContent = '?';

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const wasOpen = button.getAttribute('aria-expanded') === 'true';
      closeAll(rootDocument);
      button.setAttribute('aria-expanded', wasOpen ? 'false' : 'true');
      if (!wasOpen) {
        const popover = ensurePopover(rootDocument);
        popover.querySelector('strong').textContent = help.title;
        popover.querySelector('span').textContent = help.body;
        placePopover(popover, button);
      }
    });
    insertAfterControl(control, button);
  });

  if (root.dataset.controlHelpInstalled === 'true') return;
  root.dataset.controlHelpInstalled = 'true';
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll(rootDocument);
  });
  root.addEventListener('click', (event) => {
    if (!event.target?.closest?.('.control-help-btn')) closeAll(rootDocument);
  });
  rootDocument.defaultView?.addEventListener('resize', () => closeAll(rootDocument));
  rootDocument.defaultView?.addEventListener('scroll', () => closeAll(rootDocument), true);
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => scheduleScan(rootDocument));
    const regions = OBSERVED_UI_REGIONS
      .flatMap((selector) => [...root.querySelectorAll(selector)])
      .filter((region) => !region.closest?.('.canvas'));
    regions.forEach((region) => observer.observe(region, { childList: true, subtree: true }));
  }
}

export function staticHelpIds() {
  return Object.keys(SPECIFIC_HELP).sort();
}
