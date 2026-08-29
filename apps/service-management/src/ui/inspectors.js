/**
 * inspectors — the side panels and lists of the Service Management designer,
 * extracted from `script.js` by JUM-469.
 *
 * Owns the per-area renderers `render()` sequences: domain list and context
 * status, entity options/inspector (fields, RBAC, message contracts, OAS
 * composition), relationship list and inspector, model-check and schema-diff
 * result lists, interface adapters, service configuration, deployments, and
 * the code/example preview panes. These renderers are inherently DOM-bound;
 * their explicit interface is the factory below. State/data shaping they
 * rely on lives in the DOM-free `src/model/modelQueries.js`.
 *
 * Behaviour is verbatim from the monolith: same elements, classes, disabled
 * flags and text — with one deliberate JUM-477 exception in the RBAC
 * inspector: the tenant-scope checkbox is read-only and displays the value
 * derived from the rule's roles by the tenant RBAC contract
 * (`src/model/rbacContract.js`), because the runtime has no independent
 * tenant-scope knob to honour.
 * `render()` in `script.js` calls these in exactly the
 * pre-refactor order — the implicit sequencing (e.g. options before the
 * inspector that reads them) is now an explicit call sequence.
 *
 * JUM-480: the runtime profile pane's PM2 preview no longer carries a
 * hardcoded profile/command map. `renderPm2EcosystemPreview()` renders the
 * snapshot the orchestrator fetched from `GET /api/runtime/pm2-ecosystem`
 * (exposed through the `getPm2EcosystemPreview()` action), so the pane always
 * reflects the real `pm2/ecosystem.*.cjs` files.
 *
 * JUM-545: the interface adapter list is a full lifecycle, not add + delete.
 * Each registered adapter edits in place (type, framework, entrypoint and
 * controller mapping) through the same `upsertInterfaceAdapter` gate as the
 * add handler — rejected saves announce every issue on the JUM-543 status
 * surface and leave state untouched — and persisted entries that predate the
 * validation (free-text legacy) are flagged inline, the
 * `renderDeployments()` precedent. The add form's framework options are
 * re-synced from `src/model/interfaceFrameworkMatrix.js` on every render and
 * interface-type change, so the per-type subset never drifts from the
 * canonical runtime matrix.
 */

import { FIELD_TYPES } from '@jumentix/designer-core/state/designerState.js';
import { deriveTenantScoped } from '@jumentix/designer-core/model/rbacContract.js';
import { isSampleDomain } from '@jumentix/designer-core/model/sampleModel.js';
import { collectServiceConfigurationIssues } from '@jumentix/designer-core/validation/serviceConfigurationValidation.js';
import { collectDeployTargetIssues } from '@jumentix/designer-core/validation/deployTargetValidation.js';
import {
  INTERFACE_TYPES,
  getSupportedFrameworks
} from '@jumentix/designer-core/model/interfaceFrameworkMatrix.js';
import {
  collectInterfaceAdapterIssues,
  normalizeInterfaceAdapterInput,
  upsertInterfaceAdapter
} from '@jumentix/designer-core/validation/interfaceAdapterValidation.js';
import {
  entityLabel,
  findEntity,
  getEntityRbacPolicy,
  severityRank,
  toPathToken,
  toSchemaName
} from '@jumentix/designer-core/model/modelQueries.js';

/**
 * @param {Object} options
 * @param {Object} options.dom - resolved element map from `script.js`.
 * @param {Object} options.state - shared designer state (mutated in place).
 * @param {Object} options.interaction - shared interaction flags.
 * @param {Object} options.actions - callbacks into the orchestrator:
 * `withPersist(action)`, `render()`, `focusEntity(entityId)`,
 * `deleteRelationship(id)`, `setSelectedDomain(id)`,
 * `editFieldMetadata(entityId, fieldName)`, `updateField(entityId, fieldName, partial)`,
 * `removeField(entityId, fieldName)`, `renderRuntimeEnvironment()`,
 * `loadSchemaBaseline()`, `showStatus(message, severity)` (JUM-543
 * non-blocking status surface — replaces the monolith's window.alert),
 * `getPm2EcosystemPreview()` (JUM-480 — the latest `/api/runtime/pm2-ecosystem`
 * snapshot, or null before the first load),
 * `editDeployment(index)` / `duplicateDeployment(index)` (JUM-546 deploy
 * target lifecycle) and `syncDeploymentEditStateAfterRemoval(index)` (keeps an
 * in-flight deploy-target edit consistent when the list removes an entry).
 */
export function createInspectors({ dom, state, interaction, actions }) {
  const {
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
  } = actions;

  function getSelectedDomain() {
    return state.domains.find((domain) => domain.id === state.selectedDomainId) || null;
  }

  function renderDomainList() {
    dom.domainList.innerHTML = '';
    state.domains.forEach((domain) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = state.selectedDomainId === domain.id ? 'active' : '';
      btn.textContent = domain.name;
      // JUM-548: sample-loaded domains carry a visible marker so first-run
      // content is always distinguishable from the user's own work.
      if (isSampleDomain(domain)) {
        const badge = document.createElement('span');
        badge.className = 'sample-badge';
        badge.textContent = 'sample';
        btn.appendChild(badge);
      }
      btn.onclick = () => setSelectedDomain(domain.id);
      li.appendChild(btn);
      dom.domainList.appendChild(li);
    });
  }

  function renderStatus() {
    const selected = getSelectedDomain();
    dom.status.textContent = selected ? `Selected domain: ${selected.name}` : 'No domain selected';
    dom.domainColorInput.value = selected?.color || '#60a5fa';
    const context = selected?.context || {};
    dom.domainUbiquitousLanguageInput.value = context.ubiquitousLanguage || '';
    dom.domainOwnerTeamInput.value = context.ownerTeam || '';
    dom.domainUpstreamInput.value = Array.isArray(context.upstreamDependencies) ? context.upstreamDependencies.join(', ') : '';
    dom.domainDownstreamInput.value = Array.isArray(context.downstreamDependencies) ? context.downstreamDependencies.join(', ') : '';
    dom.domainIntegrationChannelInput.value = context.integrationChannel || '';
    dom.domainPackageDependenciesInput.value = Array.isArray(context.packageDependencies) ? context.packageDependencies.join(', ') : '';
    dom.domainSharedValueObjectsInput.value = Array.isArray(context.sharedValueObjects) ? context.sharedValueObjects.join(', ') : '';
    const disabled = !selected;
    dom.domainUbiquitousLanguageInput.disabled = disabled;
    dom.domainOwnerTeamInput.disabled = disabled;
    dom.domainUpstreamInput.disabled = disabled;
    dom.domainDownstreamInput.disabled = disabled;
    dom.domainIntegrationChannelInput.disabled = disabled;
    dom.domainPackageDependenciesInput.disabled = disabled;
    dom.domainSharedValueObjectsInput.disabled = disabled;
    dom.saveDomainContextBtn.disabled = disabled;
    dom.clearDomainContextBtn.disabled = disabled;
  }

  function renderEntityOptions() {
    const entries = [];
    state.domains.forEach((domain) => {
      domain.entities.forEach((entity) => entries.push({ id: entity.id, label: `${domain.name} / ${entity.name}` }));
    });
    const selectedMoveDomain = dom.entityMoveDomainSelect.value;
    dom.entityMoveDomainSelect.innerHTML = '';
    state.domains.forEach((domain) => {
      const option = document.createElement('option');
      option.value = domain.id;
      option.textContent = domain.name;
      dom.entityMoveDomainSelect.appendChild(option);
    });
    if (state.domains.some((domain) => domain.id === selectedMoveDomain)) {
      dom.entityMoveDomainSelect.value = selectedMoveDomain;
    }

    const fill = (selectEl) => {
      const selected = selectEl.value;
      selectEl.innerHTML = '';
      entries.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = entry.label;
        selectEl.appendChild(option);
      });
      if (entries.some((entry) => entry.id === selected)) selectEl.value = selected;
    };
    fill(dom.fromEntitySelect);
    fill(dom.toEntitySelect);
    fill(dom.relationshipFromEntitySelect);
    fill(dom.relationshipToEntitySelect);
  }

  function renderRelationshipList() {
    dom.relationshipList.innerHTML = '';
    state.relationships.forEach((relationship) => {
      const li = document.createElement('li');
      li.className = 'relationship-item';
      const name = document.createElement('div');
      name.className = 'relationship-name';
      name.textContent = `${relationship.name || 'relation'} | ${entityLabel(state.domains, relationship.fromEntityId)} (${relationship.fromCardinality}) -> (${relationship.toCardinality}) ${entityLabel(state.domains, relationship.toEntityId)}`;
      if (state.selectedRelationshipId === relationship.id) {
        name.style.borderColor = '#2563eb';
        name.style.background = '#eff6ff';
      }
      name.onclick = () => {
        state.selectedRelationshipId = relationship.id;
        render();
      };
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'x';
      del.onclick = () => deleteRelationship(relationship.id);
      li.appendChild(name);
      li.appendChild(del);
      dom.relationshipList.appendChild(li);
    });
  }

  function syncRelationshipInspector() {
    const relationship = state.relationships.find((candidate) => candidate.id === state.selectedRelationshipId);
    const disabled = !relationship;
    dom.relationshipNameInput.disabled = disabled;
    dom.relationshipFromEntitySelect.disabled = disabled;
    dom.relationshipToEntitySelect.disabled = disabled;
    dom.relationshipFromCardSelect.disabled = disabled;
    dom.relationshipToCardSelect.disabled = disabled;
    dom.relationshipLabelOffsetXInput.disabled = disabled;
    dom.relationshipLabelOffsetYInput.disabled = disabled;
    dom.relationshipBendXInput.disabled = disabled;
    dom.relationshipBendYInput.disabled = disabled;
    dom.relationshipAnchorBehaviorSelect.disabled = disabled;
    dom.resetRelationshipLabelOffsetBtn.disabled = disabled;
    dom.saveRelationshipBtn.disabled = disabled;
    dom.reverseRelationshipBtn.disabled = disabled;
    if (!relationship) {
      dom.relationshipNameInput.value = '';
      dom.relationshipFromEntitySelect.value = '';
      dom.relationshipToEntitySelect.value = '';
      dom.relationshipFromCardSelect.value = '1';
      dom.relationshipToCardSelect.value = '1';
      dom.relationshipLabelOffsetXInput.value = '';
      dom.relationshipLabelOffsetYInput.value = '';
      dom.relationshipBendXInput.value = '';
      dom.relationshipBendYInput.value = '';
      dom.relationshipAnchorBehaviorSelect.value = 'auto';
      dom.relationshipNameInput.placeholder = 'Select a relationship';
      return;
    }
    dom.relationshipNameInput.placeholder = 'Relationship name';
    dom.relationshipNameInput.value = relationship.name || '';
    dom.relationshipFromEntitySelect.value = relationship.fromEntityId;
    dom.relationshipToEntitySelect.value = relationship.toEntityId;
    dom.relationshipFromCardSelect.value = relationship.fromCardinality || '1';
    dom.relationshipToCardSelect.value = relationship.toCardinality || '1';
    dom.relationshipLabelOffsetXInput.value = Number.isFinite(relationship.labelOffsetX) ? String(relationship.labelOffsetX) : '0';
    dom.relationshipLabelOffsetYInput.value = Number.isFinite(relationship.labelOffsetY) ? String(relationship.labelOffsetY) : '0';
    dom.relationshipBendXInput.value = Number.isFinite(relationship.bendX) ? String(relationship.bendX) : '';
    dom.relationshipBendYInput.value = Number.isFinite(relationship.bendY) ? String(relationship.bendY) : '';
    dom.relationshipAnchorBehaviorSelect.value = relationship.anchorBehavior === 'center' ? 'center' : 'auto';
  }

  function renderPickStatus() {
    if (!interaction.relationshipPickActive) {
      dom.relationshipPickStatus.textContent = 'Pick mode off';
      dom.pickRelationshipBtn.textContent = 'Pick On Canvas';
      return;
    }
    if (!interaction.relationshipPickFromEntityId) {
      dom.relationshipPickStatus.textContent = 'Pick mode: select first entity';
      dom.pickRelationshipBtn.textContent = 'Cancel Pick';
      return;
    }
    dom.relationshipPickStatus.textContent = `Pick mode: select target for ${entityLabel(state.domains, interaction.relationshipPickFromEntityId)}`;
    dom.pickRelationshipBtn.textContent = 'Cancel Pick';
  }

  function renderEntityRbacInspector(entity) {
    const policy = getEntityRbacPolicy(entity);
    const action = dom.entityRbacActionSelect.value || 'list';
    const rule = policy[action] || { roles: [], tenantScoped: false };
    const roles = Array.isArray(rule.roles) ? rule.roles : [];
    dom.entityRbacSuperadminCheck.checked = roles.includes('superadmin');
    dom.entityRbacAdminCheck.checked = roles.includes('admin');
    dom.entityRbacUserCheck.checked = roles.includes('user');
    // Tenant scoping is derived from the roles by the contract (JUM-477);
    // the checkbox is read-only and always reflects the derived value.
    dom.entityRbacTenantCheck.checked = deriveTenantScoped(roles);
    dom.entityRbacList.innerHTML = '';
    ['list', 'getById', 'create', 'update', 'delete'].forEach((key) => {
      const item = document.createElement('li');
      const actionRule = policy[key] || { roles: [], tenantScoped: false };
      const actionRoles = Array.isArray(actionRule.roles) ? actionRule.roles : [];
      const label = `${key}: [${actionRoles.join(', ')}] | tenantScoped=${deriveTenantScoped(actionRoles)}`;
      item.textContent = label;
      dom.entityRbacList.appendChild(item);
    });
  }

  function renderEntityContractsInspector(entity) {
    if (!entity.meta) entity.meta = {};
    if (!Array.isArray(entity.meta.contracts)) entity.meta.contracts = [];
    dom.entityContractList.innerHTML = '';
    entity.meta.contracts.forEach((contract) => {
      const item = document.createElement('li');
      item.className = 'relationship-item';
      const summary = document.createElement('div');
      summary.className = 'relationship-name';
      summary.textContent = `${contract.type}:${contract.name} | ${contract.channel || '-'} | v${contract.version}`;
      item.appendChild(summary);
      const payloadBtn = document.createElement('button');
      payloadBtn.type = 'button';
      payloadBtn.textContent = 'payload';
      payloadBtn.onclick = () => {
        const raw = window.prompt(
          `Payload schema JSON for ${contract.type}:${contract.name}`,
          JSON.stringify(contract.payloadSchema || {}, null, 2)
        );
        if (raw === null) return;
        try {
          const parsed = raw.trim() ? JSON.parse(raw) : {};
          withPersist(() => {
            contract.payloadSchema = parsed;
            renderEntityContractsInspector(entity);
          });
        } catch (_) {
          showStatus('Invalid JSON payload schema.');
        }
      };
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'x';
      removeBtn.onclick = () => {
        withPersist(() => {
          entity.meta.contracts = entity.meta.contracts.filter((candidate) => candidate.id !== contract.id);
          renderEntityContractsInspector(entity);
        });
      };
      item.appendChild(payloadBtn);
      item.appendChild(removeBtn);
      dom.entityContractList.appendChild(item);
    });
  }

  function renderEntityInspector() {
    const found = findEntity(state.domains, state.selectedEntityId);
    dom.entityFieldList.innerHTML = '';
    dom.entityApiPreviewList.innerHTML = '';
    if (!found) {
      dom.entityInspectorTitle.textContent = 'No entity selected';
      dom.entityRenameInput.value = '';
      dom.entityRenameInput.disabled = true;
      dom.saveEntityRenameBtn.disabled = true;
      dom.duplicateEntityBtn.disabled = true;
      dom.entityMoveDomainSelect.disabled = true;
      dom.moveEntityBtn.disabled = true;
      dom.entityAggregateRootCheck.checked = false;
      dom.entityAggregateRootCheck.disabled = true;
      dom.entityInvariantsInput.value = '';
      dom.entityInvariantsInput.disabled = true;
      dom.saveEntityRulesBtn.disabled = true;
      dom.entityRbacActionSelect.disabled = true;
      dom.entityRbacSuperadminCheck.checked = false;
      dom.entityRbacAdminCheck.checked = false;
      dom.entityRbacUserCheck.checked = false;
      dom.entityRbacTenantCheck.checked = false;
      dom.entityRbacSuperadminCheck.disabled = true;
      dom.entityRbacAdminCheck.disabled = true;
      dom.entityRbacUserCheck.disabled = true;
      dom.entityRbacTenantCheck.disabled = true;
      dom.saveEntityRbacBtn.disabled = true;
      dom.entityRbacList.innerHTML = '';
      dom.entityContractNameInput.value = '';
      dom.entityContractNameInput.disabled = true;
      dom.entityContractTypeSelect.disabled = true;
      dom.entityContractChannelInput.value = '';
      dom.entityContractChannelInput.disabled = true;
      dom.entityContractVersionInput.value = '1.0.0';
      dom.entityContractVersionInput.disabled = true;
      dom.addEntityContractBtn.disabled = true;
      dom.entityContractList.innerHTML = '';
      dom.entityOasCompositionModeSelect.value = '';
      dom.entityOasCompositionModeSelect.disabled = true;
      dom.entityOasCompositionRefsInput.value = '';
      dom.entityOasCompositionRefsInput.disabled = true;
      dom.entityOasExternalRefsInput.value = '';
      dom.entityOasExternalRefsInput.disabled = true;
      dom.entityOasDiscriminatorInput.value = '';
      dom.entityOasDiscriminatorInput.disabled = true;
      dom.saveEntityOasCompositionBtn.disabled = true;
      dom.fieldTemplateSelect.disabled = true;
      dom.applyFieldTemplateBtn.disabled = true;
      return;
    }
    dom.entityInspectorTitle.textContent = `${found.domain.name} / ${found.entity.name}`;
    dom.entityRenameInput.value = found.entity.name;
    dom.entityRenameInput.disabled = false;
    dom.saveEntityRenameBtn.disabled = false;
    dom.duplicateEntityBtn.disabled = false;
    dom.entityMoveDomainSelect.disabled = false;
    dom.moveEntityBtn.disabled = false;
    dom.entityAggregateRootCheck.disabled = false;
    dom.entityAggregateRootCheck.checked = Boolean(found.entity?.meta?.aggregateRoot);
    dom.entityInvariantsInput.disabled = false;
    dom.entityInvariantsInput.value = Array.isArray(found.entity?.meta?.invariants)
      ? found.entity.meta.invariants.join('\n')
      : '';
    dom.saveEntityRulesBtn.disabled = false;
    dom.entityRbacActionSelect.disabled = false;
    dom.entityRbacSuperadminCheck.disabled = false;
    dom.entityRbacAdminCheck.disabled = false;
    dom.entityRbacUserCheck.disabled = false;
    // Read-only: tenant scoping derives from the roles per the contract.
    dom.entityRbacTenantCheck.disabled = true;
    dom.saveEntityRbacBtn.disabled = false;
    renderEntityRbacInspector(found.entity);
    dom.entityContractNameInput.disabled = false;
    dom.entityContractTypeSelect.disabled = false;
    dom.entityContractChannelInput.disabled = false;
    dom.entityContractVersionInput.disabled = false;
    dom.addEntityContractBtn.disabled = false;
    if (!dom.entityContractVersionInput.value) dom.entityContractVersionInput.value = '1.0.0';
    renderEntityContractsInspector(found.entity);
    dom.entityOasCompositionModeSelect.disabled = false;
    dom.entityOasCompositionRefsInput.disabled = false;
    dom.entityOasExternalRefsInput.disabled = false;
    dom.entityOasDiscriminatorInput.disabled = false;
    dom.saveEntityOasCompositionBtn.disabled = false;
    const composition = found.entity?.meta?.oasComposition || { mode: '', refs: [], externalRefs: [], discriminator: '' };
    dom.entityOasCompositionModeSelect.value = composition.mode || '';
    dom.entityOasCompositionRefsInput.value = Array.isArray(composition.refs) ? composition.refs.join(', ') : '';
    dom.entityOasExternalRefsInput.value = Array.isArray(composition.externalRefs) ? composition.externalRefs.join(', ') : '';
    dom.entityOasDiscriminatorInput.value = composition.discriminator || '';
    dom.fieldTemplateSelect.disabled = false;
    dom.applyFieldTemplateBtn.disabled = false;
    dom.entityMoveDomainSelect.value = found.domain.id;
    found.entity.fields.forEach((field) => {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'field-row';
      // JUM-732: every control in a generated field row carries the field it
      // belongs to in its accessible name. Before this, the name input and the
      // type select computed no accessible name at all, and the three buttons
      // read as "meta", "save" and "x" repeated once per field — a name with no
      // referent. The visible labels stay as they are; only the announced name
      // changes, so sighted users see the same compact row.
      const fieldLabel = `field "${field.name}"`;
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = field.name;
      nameInput.setAttribute('aria-label', `Name of ${fieldLabel}`);
      const typeSelect = document.createElement('select');
      FIELD_TYPES.forEach((optionValue) => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        typeSelect.appendChild(option);
      });
      typeSelect.value = field.type;
      typeSelect.setAttribute('aria-label', `Type of ${fieldLabel}`);
      const requiredCheck = document.createElement('input');
      requiredCheck.type = 'checkbox';
      requiredCheck.checked = field.required;
      requiredCheck.title = 'required';
      requiredCheck.setAttribute('aria-label', `Required — ${fieldLabel}`);
      const pkCheck = document.createElement('input');
      pkCheck.type = 'checkbox';
      pkCheck.checked = field.pk;
      pkCheck.title = 'PK';
      pkCheck.setAttribute('aria-label', `Primary key — ${fieldLabel}`);
      const fkCheck = document.createElement('input');
      fkCheck.type = 'checkbox';
      fkCheck.checked = field.fk;
      fkCheck.title = 'FK';
      fkCheck.setAttribute('aria-label', `Foreign key — ${fieldLabel}`);
      const uniqueCheck = document.createElement('input');
      uniqueCheck.type = 'checkbox';
      uniqueCheck.checked = field.unique;
      uniqueCheck.title = 'unique';
      uniqueCheck.setAttribute('aria-label', `Unique — ${fieldLabel}`);
      const nullableCheck = document.createElement('input');
      nullableCheck.type = 'checkbox';
      nullableCheck.checked = field.nullable;
      nullableCheck.title = 'nullable';
      nullableCheck.setAttribute('aria-label', `Nullable — ${fieldLabel}`);
      const meta = document.createElement('button');
      meta.type = 'button';
      meta.textContent = 'meta';
      meta.setAttribute('aria-label', `Edit metadata of ${fieldLabel}`);
      meta.onclick = () => editFieldMetadata(found.entity.id, field.name);
      const save = document.createElement('button');
      save.type = 'button';
      save.textContent = 'save';
      save.setAttribute('aria-label', `Save ${fieldLabel}`);
      save.onclick = () => updateField(found.entity.id, field.name, {
        name: nameInput.value,
        type: typeSelect.value,
        required: requiredCheck.checked,
        pk: pkCheck.checked,
        fk: fkCheck.checked,
        unique: uniqueCheck.checked,
        nullable: nullableCheck.checked
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'x';
      del.setAttribute('aria-label', `Delete ${fieldLabel}`);
      del.onclick = () => removeField(found.entity.id, field.name);
      row.appendChild(nameInput);
      row.appendChild(typeSelect);
      row.appendChild(requiredCheck);
      row.appendChild(pkCheck);
      row.appendChild(fkCheck);
      row.appendChild(uniqueCheck);
      row.appendChild(nullableCheck);
      row.appendChild(meta);
      row.appendChild(save);
      row.appendChild(del);
      li.appendChild(row);
      dom.entityFieldList.appendChild(li);
    });

    const domainPath = toPathToken(found.domain.name) || 'domain';
    const entityPath = toPathToken(found.entity.name) || 'entity';
    const schemaName = toSchemaName(found.domain.name, found.entity.name);
    const operations = [
      `GET /${domainPath}/${entityPath} -> list${schemaName}`,
      `POST /${domainPath}/${entityPath} -> create${schemaName}`,
      `GET /${domainPath}/${entityPath}/{id} -> get${schemaName}ById`,
      `PATCH /${domainPath}/${entityPath}/{id} -> update${schemaName}`,
      `DELETE /${domainPath}/${entityPath}/{id} -> delete${schemaName}`
    ];
    operations.forEach((operation) => {
      const li = document.createElement('li');
      li.textContent = operation;
      dom.entityApiPreviewList.appendChild(li);
    });
  }

  function renderModelCheckResults(issues) {
    dom.modelCheckList.innerHTML = '';
    const threshold = state.view.modelCheckMinSeverity || 'info';
    const filtered = issues.filter((issue) => severityRank(issue.severity || 'error') >= severityRank(threshold));
    if (!filtered.length) {
      const li = document.createElement('li');
      li.textContent = 'No issues found.';
      dom.modelCheckList.appendChild(li);
      return;
    }
    filtered.forEach((issue) => {
      const li = document.createElement('li');
      const prefix = `[${String(issue.severity || 'error').toUpperCase()}] `;
      if (issue.entityId) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = `${prefix}${issue.message}`;
        btn.onclick = () => focusEntity(issue.entityId);
        li.appendChild(btn);
      } else {
        li.textContent = `${prefix}${issue.message}`;
      }
      dom.modelCheckList.appendChild(li);
    });
  }

  function renderSchemaDiffResults(items) {
    dom.schemaDiffList.innerHTML = '';
    if (!Array.isArray(items) || !items.length) {
      const li = document.createElement('li');
      li.textContent = 'No schema diff available.';
      dom.schemaDiffList.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = `[${String(item.severity || 'info').toUpperCase()}] ${item.message}`;
      dom.schemaDiffList.appendChild(li);
    });
  }

  async function renderSchemaDiffStatus() {
    if (dom.schemaDiffList.children.length > 0) return;
    const hasBaseline = Boolean(await loadSchemaBaseline());
    renderSchemaDiffResults([{
      severity: hasBaseline ? 'info' : 'warn',
      message: hasBaseline ? 'Baseline loaded. Run diff to preview migration hints.' : 'No baseline saved yet.'
    }]);
  }

  // Index of the adapter whose inline editor is open (JUM-545 edit-in-place);
  // null when no edit is in flight. Reset whenever the list mutates.
  let editingAdapterIndex = null;

  /**
   * Re-syncs the add form's framework `<select>` with the per-type subset of
   * the canonical runtime matrix (`src/model/interfaceFrameworkMatrix.js`).
   * The current selection is kept when it is still valid for the type.
   *
   * @param {string} type - the interface type the options must fit.
   * @param {string} [selectedValue] - explicit selection; defaults to the
   *   select's current value.
   */
  function renderInterfaceFrameworkOptions(type, selectedValue = '') {
    if (!dom.interfaceFrameworkSelect) return;
    const frameworks = getSupportedFrameworks(type);
    const current = selectedValue || dom.interfaceFrameworkSelect.value;
    dom.interfaceFrameworkSelect.innerHTML = '';
    frameworks.forEach((framework) => {
      const option = document.createElement('option');
      option.value = framework;
      option.textContent = framework;
      dom.interfaceFrameworkSelect.appendChild(option);
    });
    dom.interfaceFrameworkSelect.value = frameworks.includes(current) ? current : (frameworks[0] || '');
  }

  /**
   * Builds the edit-in-place editor for one adapter (JUM-545): type,
   * framework (re-scoped to the type's subset on every type change),
   * entrypoint and controller mapping. Save goes through the same
   * `upsertInterfaceAdapter` gate as the add handler — a rejected save
   * announces every issue on the JUM-543 status surface and leaves both
   * state and the open editor untouched, so a typo can be corrected without
   * delete-and-re-add.
   */
  function buildInterfaceAdapterEditor(adapter, index) {
    const editor = document.createElement('div');
    editor.className = 'interface-adapter-editor';

    const typeSelect = document.createElement('select');
    typeSelect.setAttribute('aria-label', 'Edit interface type');
    INTERFACE_TYPES.forEach((optionValue) => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      typeSelect.appendChild(option);
    });
    typeSelect.value = INTERFACE_TYPES.includes(adapter.type) ? adapter.type : INTERFACE_TYPES[0];

    const frameworkSelect = document.createElement('select');
    frameworkSelect.setAttribute('aria-label', 'Edit framework/runtime');
    const syncFrameworkOptions = (selectedValue) => {
      const frameworks = getSupportedFrameworks(typeSelect.value);
      frameworkSelect.innerHTML = '';
      frameworks.forEach((framework) => {
        const option = document.createElement('option');
        option.value = framework;
        option.textContent = framework;
        frameworkSelect.appendChild(option);
      });
      frameworkSelect.value = frameworks.includes(selectedValue) ? selectedValue : (frameworks[0] || '');
    };
    typeSelect.onchange = () => syncFrameworkOptions('');
    syncFrameworkOptions(adapter.framework);

    const entrypointInput = document.createElement('input');
    entrypointInput.type = 'text';
    entrypointInput.value = adapter.entrypoint || '';
    entrypointInput.setAttribute('aria-label', 'Edit entrypoint');

    const controllerInput = document.createElement('input');
    controllerInput.type = 'text';
    controllerInput.value = adapter.controller || '';
    controllerInput.setAttribute('aria-label', 'Edit controller mapping');

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => {
      const candidate = normalizeInterfaceAdapterInput({
        type: typeSelect.value,
        framework: frameworkSelect.value,
        entrypoint: entrypointInput.value,
        controller: controllerInput.value
      });
      const result = upsertInterfaceAdapter(state.interfaces, candidate, index);
      if (result.issues.length > 0) {
        showStatus(result.issues.map((issue) => issue.message).join(' '));
        return;
      }
      withPersist(() => {
        state.interfaces = result.adapters;
        editingAdapterIndex = null;
        renderInterfaceAdapters();
      });
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
      editingAdapterIndex = null;
      renderInterfaceAdapters();
    };

    editor.appendChild(typeSelect);
    editor.appendChild(frameworkSelect);
    editor.appendChild(entrypointInput);
    editor.appendChild(controllerInput);
    editor.appendChild(saveBtn);
    editor.appendChild(cancelBtn);
    return editor;
  }

  function renderInterfaceAdapters() {
    if (!dom.interfaceAdapterList) return;
    // JUM-548: the tab's guided empty state tracks the list on every render
    // path, including the partial renders of the delete buttons.
    if (dom.interfaceDesignerEmptyState) {
      dom.interfaceDesignerEmptyState.hidden = state.interfaces.length > 0;
    if (editingAdapterIndex !== null
      && (editingAdapterIndex < 0 || editingAdapterIndex >= state.interfaces.length)) {
      editingAdapterIndex = null;
    }
    if (dom.interfaceTypeSelect) {
      renderInterfaceFrameworkOptions(dom.interfaceTypeSelect.value);
    }
    dom.interfaceAdapterList.innerHTML = '';
    state.interfaces.forEach((adapter, index) => {
      const item = document.createElement('li');
      item.className = 'relationship-item';
      const summary = document.createElement('div');
      summary.className = 'relationship-name';
      summary.textContent = `${adapter.type} | ${adapter.framework} | ${adapter.entrypoint} -> ${adapter.controller}`;
      item.appendChild(summary);

      // A persisted entry can predate the JUM-545 lifecycle validation (it
      // was free text before the gate existed): flag it inline instead of
      // rendering it as a valid design. The entry excludes itself from the
      // duplicate scan (editingIndex = index).
      const persistedIssues = collectInterfaceAdapterIssues(adapter, state.interfaces, index);
      if (persistedIssues.length > 0) {
        const warning = document.createElement('div');
        warning.className = 'hint status-error';
        warning.textContent = persistedIssues.map((issue) => issue.message).join(' ');
        item.appendChild(warning);
      }

      if (editingAdapterIndex === index) {
        item.appendChild(buildInterfaceAdapterEditor(adapter, index));
      } else {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.textContent = 'Edit';
        editBtn.onclick = () => {
          editingAdapterIndex = index;
          renderInterfaceAdapters();
        };
        item.appendChild(editBtn);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'Delete';
        removeBtn.onclick = () => {
          withPersist(() => {
            state.interfaces.splice(index, 1);
            editingAdapterIndex = null;
            renderInterfaceAdapters();
          });
        };
        item.appendChild(removeBtn);
      }
      dom.interfaceAdapterList.appendChild(item);
    });
  }
  }

  function renderServiceConfiguration() {
    if (!dom.serviceKindSelect) return;
    dom.serviceKindSelect.value = state.serviceConfiguration.serviceKind || 'rest-api';
    dom.runModeSelect.value = state.serviceConfiguration.runMode || 'dedicated-server';
    dom.cloudProviderSelect.value = state.serviceConfiguration.cloudProvider || 'aws';
    dom.serviceStaticAssetsInput.value = state.serviceConfiguration.staticAssetsPath || '';
    const currentPorts = state.serviceConfiguration.ports || { rest: 3000, websocket: 3001, grpc: 3002 };
    if (dom.serviceHttpPortInput) dom.serviceHttpPortInput.value = String(currentPorts.rest || 3000);
    if (dom.serviceWebsocketPortInput) dom.serviceWebsocketPortInput.value = String(currentPorts.websocket || 3001);
    if (dom.serviceGrpcPortInput) dom.serviceGrpcPortInput.value = String(currentPorts.grpc || 3002);

    renderPm2EcosystemPreview();
    if (!dom.serviceConfigPreview) return;
    dom.serviceConfigPreview.textContent = JSON.stringify(state.serviceConfiguration, null, 2);
    renderServiceConfigStatus();
    renderRuntimeEnvironment();
  }

  // Service-kind → ecosystem app-name suffixes (JUM-480). The app names come
  // from the real pm2/ecosystem.*.cjs files (`jumentix-<env>-restapi`, …);
  // matching by suffix keeps the filter valid for every environment prefix
  // (dev/staging/production) without enumerating names here.
  const SERVICE_KIND_APP_SUFFIXES = {
    'rest-api': ['restapi'],
    'websocket-rest-api': ['restapi', 'websocketapi'],
    'grpc-rest-api': ['restapi', 'grpcapi']
  };
  const SERVICE_KIND_LABELS = {
    'rest-api': 'REST API',
    'websocket-rest-api': 'WebSocket API + REST API',
    'grpc-rest-api': 'gRPC API + REST API'
  };

  /**
   * Renders the PM2 ecosystem preview (JUM-480) from the snapshot the
   * orchestrator fetched from `GET /api/runtime/pm2-ecosystem`. Every process
   * name, script and command comes from the real ecosystem file — the
   * designer hardcodes no process list and no package-manager invocation, so
   * an ecosystem edit (or the Bun cutover changing invocation format) is
   * reflected without a code change. Missing ecosystem files and load
   * failures render as explicit states, never a silently empty pane.
   */
  function renderPm2EcosystemPreview() {
    if (!dom.serviceRuntimeProfilePreview) return;
    const currentPorts = state.serviceConfiguration.ports || { rest: 3000, websocket: 3001, grpc: 3002 };
    const serviceKind = state.serviceConfiguration.serviceKind || 'rest-api';
    const preview = getPm2EcosystemPreview();
    if (!preview) {
      dom.serviceRuntimeProfilePreview.textContent = 'PM2 ecosystem preview not loaded yet — select a PM2 Preview Environment above.';
      return;
    }
    if (preview.error) {
      dom.serviceRuntimeProfilePreview.textContent = `PM2 ecosystem preview unavailable for environment "${preview.environment}": ${preview.error}`;
      return;
    }
    if (!preview.exists) {
      dom.serviceRuntimeProfilePreview.textContent = `No PM2 ecosystem file for environment "${preview.environment}" (expected ${preview.path}). The preview is intentionally empty.`;
      return;
    }
    const suffixes = SERVICE_KIND_APP_SUFFIXES[serviceKind] || SERVICE_KIND_APP_SUFFIXES['rest-api'];
    const selectedApps = preview.apps.filter((app) => suffixes.some((suffix) => app.name.endsWith(`-${suffix}`)));
    const suggestedPm2Command = selectedApps.length > 0
      ? `pm2 start ${preview.path} --only ${selectedApps.map((app) => app.name).join(',')} --update-env`
      : '';
    dom.serviceRuntimeProfilePreview.textContent = JSON.stringify({
      selectedRuntimeProfile: SERVICE_KIND_LABELS[serviceKind] || SERVICE_KIND_LABELS['rest-api'],
      vmRequirement: 'Use PM2 with separated processes and ports',
      environment: preview.environment,
      ecosystemFile: preview.path,
      ecosystemApps: preview.apps.map((app) => ({
        name: app.name,
        script: app.script,
        command: app.command
      })),
      processCount: selectedApps.length,
      processes: selectedApps.map((app) => app.name),
      ports: currentPorts,
      suggestedPm2Command
    }, null, 2);
  }

  /**
   * The Service Configuration tab's non-blocking status surface (JUM-544;
   * the existing `hint`-paragraph pattern — JUM-543 owns the cross-suite
   * alert replacement and will fold this element into whatever shared
   * surface it standardises on).
   *
   * @param {?Array} issues - issues of a rejected candidate when called from
   *   the save gate; null re-validates the persisted profile, so a loaded
   *   invalid state is flagged too.
   */
  function renderServiceConfigStatus(issues = null) {
    if (!dom.serviceConfigStatus) return;
    const current = issues || collectServiceConfigurationIssues(state.serviceConfiguration);
    if (!current.length) {
      dom.serviceConfigStatus.textContent = 'Profile valid.';
      dom.serviceConfigStatus.classList.remove('status-error');
      return;
    }
    dom.serviceConfigStatus.textContent = current.map((issue) => issue.message).join(' ');
    dom.serviceConfigStatus.classList.add('status-error');
  }

  function renderDeployments() {
    if (!dom.deployTargetList) return;
    // JUM-548: same empty-state tracking as renderInterfaceAdapters.
    if (dom.deployManagementEmptyState) {
      dom.deployManagementEmptyState.hidden = state.deployments.length > 0;
    }
    dom.deployTargetList.innerHTML = '';
    state.deployments.forEach((deployment, index) => {
      const item = document.createElement('li');
      item.className = 'relationship-item';
      const summary = document.createElement('div');
      summary.className = 'relationship-name';
      // Requirement 059 metadata contract (JUM-481): every target shows the
      // six matrix dimensions next to the legacy name/region/runtime; the PM2
      // profile appears only where the matrix has one (PM2-managed targets).
      const profile = deployment.pm2Profile ? ` | pm2:${deployment.pm2Profile}` : '';
      summary.textContent = `${deployment.name} | ${deployment.deployTarget} | ${deployment.serviceType} | ${deployment.runtimeProtocol} | db:${deployment.databaseDriver} | kv:${deployment.keyValueDriver}${profile} | ${deployment.region} | ${deployment.runtime}`;
      item.appendChild(summary);

      // A persisted entry can predate the matrix alignment (e.g. a legacy
      // provider with no Requirement 059 row, migrated losslessly on load):
      // flag it inline instead of rendering it as a buildable design.
      const issues = collectDeployTargetIssues(deployment);
      if (issues.length > 0) {
        const warning = document.createElement('div');
        warning.className = 'hint status-error';
        warning.textContent = issues.map((issue) => issue.message).join(' ');
        item.appendChild(warning);
      }

      // JUM-546 lifecycle: edit loads the entry into the form (the add gate
      // becomes the save gate); duplicate stores an independent deep copy
      // renamed by the " (copy)" rule.
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';
      editBtn.onclick = () => editDeployment(index);
      item.appendChild(editBtn);

      const duplicateBtn = document.createElement('button');
      duplicateBtn.type = 'button';
      duplicateBtn.textContent = 'Duplicate';
      duplicateBtn.onclick = () => duplicateDeployment(index);
      item.appendChild(duplicateBtn);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Delete';
      removeBtn.onclick = () => {
        withPersist(() => {
          state.deployments.splice(index, 1);
          syncDeploymentEditStateAfterRemoval(index);
          renderDeployments();
        });
      };
      item.appendChild(removeBtn);
      dom.deployTargetList.appendChild(item);
    });
  }

  return {
    renderDomainList,
    renderStatus,
    renderEntityOptions,
    renderRelationshipList,
    syncRelationshipInspector,
    renderPickStatus,
    renderEntityRbacInspector,
    renderEntityContractsInspector,
    renderEntityInspector,
    renderModelCheckResults,
    renderSchemaDiffResults,
    renderSchemaDiffStatus,
    renderInterfaceAdapters,
    renderInterfaceFrameworkOptions,
    renderServiceConfiguration,
    renderPm2EcosystemPreview,
    renderServiceConfigStatus,
    renderDeployments
  };
}
