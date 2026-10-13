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

import { FIELD_TYPES, parseCommaSeparated } from '@jumentix/designer-core/state/designerState.js';
import { deriveTenantScoped } from '@jumentix/designer-core/model/rbacContract.js';
import { isSampleDomain, isSampleEntity } from '@jumentix/designer-core/model/sampleModel.js';
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
import { createTagEditor } from './tagEditor.js';

const KNOWN_INTEGRATION_CHANNELS = new Set(['http', 'async', 'grpc', 'graphql', 'events']);

/**
 * @param {Object} options
 * @param {Object} options.dom - resolved element map from `script.js`.
 * @param {Object} options.state - shared designer state (mutated in place).
 * @param {Object} options.interaction - shared interaction flags.
 * @param {Object} options.actions - callbacks into the orchestrator:
 * `withPersist(action)`, `render()`, `focusEntity(entityId)`,
 * `deleteRelationship(id)`, `setSelectedDomain(id)`, `setSelectedEntity(id)`,
 * `setSelectedRelationship(id)`,
 * `persistDomainContext()`, `editFieldMetadata(entityId, fieldName)`, `updateField(entityId, fieldName, partial)`,
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
    setSelectedEntity,
    setSelectedField,
    setSelectedRelationship,
    cycleSelectedRelationship,
    relationshipsInNavScope,
    persistDomainContext,
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

  let domainTagEditors = null;
  // Only reload tag chips when the selected domain changes (or after an
  // explicit force). Re-writing on every canvas render would wipe in-progress Add.
  let boundDomainContextId = null;
  let domainAutosaveWired = false;
  // Suppress autosave while hydrating the form for a newly selected domain —
  // otherwise blur/change from the previous focus writes the wrong domain's
  // leftover field values into the newly selected context.
  let domainContextHydrating = false;

  function getSelectedDomain() {
    return state.domains.find((domain) => domain.id === state.selectedDomainId) || null;
  }

  function requestDomainContextPersist() {
    if (domainContextHydrating) return;
    if (typeof persistDomainContext === 'function') persistDomainContext();
  }

  /**
   * Normalize legacy CSV strings or arrays into a unique string list.
   * Single adapter for inspector boundaries — UI never invents summary labels.
   */
  function asStringList(raw) {
    return [...new Set(parseCommaSeparated(raw || []))];
  }

  /** Model stores ubiquitousLanguage as a single string; lists stay arrays. */
  function serializeUbiquitousLanguage(terms) {
    return asStringList(terms).join(', ');
  }

  function syncDomainIntegrationChannelOther() {
    const select = dom.domainIntegrationChannelInput;
    const other = dom.domainIntegrationChannelOtherInput;
    if (!select || !other) return;
    const isOther = select.value === 'other';
    other.hidden = !isOther;
    if (!isOther) other.value = '';
  }

  function modelDomainNames(excludeName = '') {
    return state.domains
      .map((domain) => domain.name)
      .filter((name) => name && name !== excludeName);
  }

  function readCheckedDomainNames(listEl) {
    if (!listEl) return [];
    return Array.from(listEl.querySelectorAll('input[type="checkbox"][data-domain-name]:checked'))
      .map((input) => input.getAttribute('data-domain-name'))
      .filter(Boolean);
  }

  function renderDomainDependencyChecks(listEl, selectedNames, currentDomainName, disabled) {
    if (!listEl) return;
    const selected = new Set(selectedNames || []);
    const others = modelDomainNames(currentDomainName);
    listEl.innerHTML = '';
    if (others.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'field-hint domain-check-empty';
      empty.textContent = 'No other domains on the canvas yet. Create another domain, or add an external name below.';
      listEl.appendChild(empty);
      return;
    }
    others.forEach((name) => {
      const label = document.createElement('label');
      label.className = 'domain-check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('data-domain-name', name);
      input.checked = selected.has(name);
      input.disabled = disabled;
      input.onchange = () => requestDomainContextPersist();
      label.appendChild(input);
      label.appendChild(document.createTextNode(` ${name}`));
      listEl.appendChild(label);
    });
  }

  function ensureDomainTagEditors() {
    if (domainTagEditors) return domainTagEditors;
    const onChange = () => requestDomainContextPersist();
    domainTagEditors = {
      ubiquitous: createTagEditor({
        root: document.getElementById('domain-ubiquitous-language-editor'),
        emptyLabel: 'No terms yet — type one and press Enter',
        onChange
      }),
      upstream: createTagEditor({
        root: document.getElementById('domain-upstream-editor'),
        emptyLabel: 'No external systems yet',
        onChange
      }),
      downstream: createTagEditor({
        root: document.getElementById('domain-downstream-editor'),
        emptyLabel: 'No external consumers yet',
        onChange
      }),
      packages: createTagEditor({
        root: document.getElementById('domain-package-dependencies-editor'),
        emptyLabel: 'No packages yet — type one and press Enter',
        onChange
      }),
      sharedVos: createTagEditor({
        root: document.getElementById('domain-shared-value-objects-editor'),
        emptyLabel: 'No shared value objects yet — type one and press Enter',
        onChange
      })
    };
    return domainTagEditors;
  }

  function wireDomainAutosaveControls() {
    if (domainAutosaveWired) return;
    domainAutosaveWired = true;
    if (dom.domainOwnerTeamInput) {
      dom.domainOwnerTeamInput.addEventListener('change', () => requestDomainContextPersist());
      dom.domainOwnerTeamInput.addEventListener('blur', () => requestDomainContextPersist());
    }
    if (dom.domainIntegrationChannelInput) {
      dom.domainIntegrationChannelInput.addEventListener('change', () => {
        syncDomainIntegrationChannelOther();
        if (dom.domainIntegrationChannelInput.value !== 'other') {
          requestDomainContextPersist();
        }
      });
    }
    if (dom.domainIntegrationChannelOtherInput) {
      dom.domainIntegrationChannelOtherInput.addEventListener('change', () => requestDomainContextPersist());
      dom.domainIntegrationChannelOtherInput.addEventListener('blur', () => requestDomainContextPersist());
    }
  }

  function readDomainContextForm() {
    const editors = ensureDomainTagEditors();
    const selected = getSelectedDomain();
    const modelNames = new Set(modelDomainNames(selected?.name || ''));
    const select = dom.domainIntegrationChannelInput;
    const other = dom.domainIntegrationChannelOtherInput;
    let channel = String(select?.value || '').trim();
    if (channel === 'other') {
      channel = String(other?.value || '').trim();
    }
    const upstreamChecked = readCheckedDomainNames(dom.domainUpstreamCheckList);
    const downstreamChecked = readCheckedDomainNames(dom.domainDownstreamCheckList);
    const upstreamExternal = editors.upstream.getValues().filter((name) => !modelNames.has(name));
    const downstreamExternal = editors.downstream.getValues().filter((name) => !modelNames.has(name));
    return {
      ubiquitousLanguage: serializeUbiquitousLanguage(editors.ubiquitous.getValues()),
      ownerTeam: String(dom.domainOwnerTeamInput?.value || '').trim(),
      upstreamDependencies: asStringList([...upstreamChecked, ...upstreamExternal]),
      downstreamDependencies: asStringList([...downstreamChecked, ...downstreamExternal]),
      integrationChannel: channel,
      packageDependencies: asStringList(editors.packages.getValues()),
      sharedValueObjects: asStringList(editors.sharedVos.getValues())
    };
  }

  function clearDomainContextForm() {
    const editors = ensureDomainTagEditors();
    editors.ubiquitous.clear({ silent: true });
    editors.upstream.clear({ silent: true });
    editors.downstream.clear({ silent: true });
    editors.packages.clear({ silent: true });
    editors.sharedVos.clear({ silent: true });
    if (dom.domainOwnerTeamInput) dom.domainOwnerTeamInput.value = '';
    if (dom.domainIntegrationChannelInput) dom.domainIntegrationChannelInput.value = '';
    if (dom.domainIntegrationChannelOtherInput) {
      dom.domainIntegrationChannelOtherInput.value = '';
      dom.domainIntegrationChannelOtherInput.hidden = true;
    }
    renderDomainDependencyChecks(dom.domainUpstreamCheckList, [], getSelectedDomain()?.name || '', false);
    renderDomainDependencyChecks(dom.domainDownstreamCheckList, [], getSelectedDomain()?.name || '', false);
  }

  function writeDomainContextForm(context = {}, {
    disabled = false,
    selectedDomainName = '',
    domainId = null,
    force = false
  } = {}) {
    wireDomainAutosaveControls();
    const editors = ensureDomainTagEditors();
    const shouldLoadValues = force || domainId !== boundDomainContextId;
    const modelNames = new Set(modelDomainNames(selectedDomainName));
    const upstreamAll = asStringList(context.upstreamDependencies);
    const downstreamAll = asStringList(context.downstreamDependencies);
    const upstreamModel = upstreamAll.filter((name) => modelNames.has(name));
    const downstreamModel = downstreamAll.filter((name) => modelNames.has(name));
    const upstreamExternal = upstreamAll.filter((name) => !modelNames.has(name));
    const downstreamExternal = downstreamAll.filter((name) => !modelNames.has(name));
    const packageDeps = asStringList(context.packageDependencies);
    const sharedVos = asStringList(context.sharedValueObjects);

    if (shouldLoadValues) {
      domainContextHydrating = true;
      boundDomainContextId = domainId;
      // Always replace field values when the selected domain changes — never
      // preserve leftover focus state from the previously selected domain.
      if (dom.domainOwnerTeamInput) {
        dom.domainOwnerTeamInput.value = context.ownerTeam || '';
      }
      editors.ubiquitous.setValues(asStringList(context.ubiquitousLanguage), { silent: true });
      editors.upstream.setValues(upstreamExternal, { silent: true });
      editors.downstream.setValues(downstreamExternal, { silent: true });
      editors.packages.setValues(packageDeps, { silent: true });
      editors.sharedVos.setValues(sharedVos, { silent: true });

      const channel = String(context.integrationChannel || '').trim();
      if (dom.domainIntegrationChannelInput) {
        if (!channel) {
          dom.domainIntegrationChannelInput.value = '';
        } else if (KNOWN_INTEGRATION_CHANNELS.has(channel)) {
          dom.domainIntegrationChannelInput.value = channel;
        } else {
          dom.domainIntegrationChannelInput.value = 'other';
          if (dom.domainIntegrationChannelOtherInput) {
            dom.domainIntegrationChannelOtherInput.value = channel;
          }
        }
      }
      syncDomainIntegrationChannelOther();
      if (
        dom.domainIntegrationChannelOtherInput
        && dom.domainIntegrationChannelInput?.value === 'other'
        && channel
        && !KNOWN_INTEGRATION_CHANNELS.has(channel)
      ) {
        dom.domainIntegrationChannelOtherInput.hidden = false;
        dom.domainIntegrationChannelOtherInput.value = channel;
      }
      // Release after the current event stack so any blur/change caused by
      // swapping selection cannot persist the previous domain's leftovers.
      globalThis.setTimeout(() => {
        domainContextHydrating = false;
      }, 0);
    }

    // Checklists always refresh so newly created domains appear immediately.
    renderDomainDependencyChecks(
      dom.domainUpstreamCheckList,
      shouldLoadValues ? upstreamModel : readCheckedDomainNames(dom.domainUpstreamCheckList),
      selectedDomainName,
      disabled
    );
    renderDomainDependencyChecks(
      dom.domainDownstreamCheckList,
      shouldLoadValues ? downstreamModel : readCheckedDomainNames(dom.domainDownstreamCheckList),
      selectedDomainName,
      disabled
    );

    editors.ubiquitous.setDisabled(disabled);
    editors.upstream.setDisabled(disabled);
    editors.downstream.setDisabled(disabled);
    editors.packages.setDisabled(disabled);
    editors.sharedVos.setDisabled(disabled);
    if (dom.domainIntegrationChannelInput) dom.domainIntegrationChannelInput.disabled = disabled;
    if (dom.domainIntegrationChannelOtherInput) dom.domainIntegrationChannelOtherInput.disabled = disabled;
    if (dom.domainOwnerTeamInput) dom.domainOwnerTeamInput.disabled = disabled;
    if (dom.saveDomainContextBtn) dom.saveDomainContextBtn.disabled = disabled;
    if (dom.clearDomainContextBtn) dom.clearDomainContextBtn.disabled = disabled;
  }

  /** Domain panels the user manually collapsed while still selected. */
  const collapsedDomainIds = new Set();

  /**
   * Domain ⊃ Entity tree — each domain is an expandable panel; entities nest
   * inside. Flat peer lists are forbidden: hierarchy must be visible in one glance.
   */
  function renderDomainList() {
    if (!dom.domainList) return;
    dom.domainList.innerHTML = '';
    dom.domainList.classList.add('domain-tree');

    state.domains.forEach((domain) => {
      const entities = Array.isArray(domain.entities) ? domain.entities : [];
      const isSelectedDomain = state.selectedDomainId === domain.id;
      const ownsSelectedEntity = entities.some((entity) => entity.id === state.selectedEntityId);
      // Selected domain (or domain owning the selected entity) expands unless user collapsed it.
      const expanded = (isSelectedDomain || ownsSelectedEntity) && !collapsedDomainIds.has(domain.id);

      const li = document.createElement('li');
      li.className = 'domain-tree-item';
      li.dataset.domainId = domain.id;
      li.dataset.expanded = String(expanded);
      if (isSelectedDomain) li.classList.add('is-domain-selected');
      if (ownsSelectedEntity) li.classList.add('is-context-active');

      const header = document.createElement('div');
      header.className = 'domain-tree-header';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'domain-tree-toggle';
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute('aria-controls', `domain-tree-children-${domain.id}`);
      toggle.title = expanded ? 'Collapse entities' : 'Expand entities';
      toggle.innerHTML = '<span class="domain-tree-chevron" aria-hidden="true"></span>';
      toggle.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (expanded) collapsedDomainIds.add(domain.id);
        else {
          collapsedDomainIds.delete(domain.id);
          if (!isSelectedDomain) setSelectedDomain(domain.id);
        }
        renderDomainList();
      };

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `domain-tree-domain${isSelectedDomain && !state.selectedEntityId ? ' active' : ''}`;
      btn.setAttribute('aria-current', isSelectedDomain ? 'true' : 'false');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'domain-tree-name';
      nameSpan.textContent = domain.name;
      btn.appendChild(nameSpan);
      if (isSampleDomain(domain)) {
        const badge = document.createElement('span');
        badge.className = 'sample-badge';
        badge.textContent = 'sample';
        btn.appendChild(badge);
      }
      const count = document.createElement('span');
      count.className = 'list-meta';
      count.textContent = `${entities.length}`;
      count.title = 'Entities in this domain';
      btn.appendChild(count);
      btn.onclick = () => {
        collapsedDomainIds.delete(domain.id);
        // Tree pick must remount peers + Camera3 exclusive domain frame
        // (same contract as canvas domain click-end). Never chrome-only.
        setSelectedDomain(domain.id, { remountCanvas: true });
      };

      header.appendChild(toggle);
      header.appendChild(btn);
      li.appendChild(header);

      const children = document.createElement('ul');
      children.className = 'domain-tree-children list jx-list';
      children.id = `domain-tree-children-${domain.id}`;
      children.hidden = !expanded;
      children.setAttribute('aria-label', `Entities in ${domain.name}`);

      if (expanded) {
        if (!entities.length) {
          const empty = document.createElement('li');
          empty.className = 'domain-tree-empty';
          empty.textContent = 'No entities yet — add one below.';
          children.appendChild(empty);
        }
        entities.forEach((entity) => {
          const childLi = document.createElement('li');
          childLi.className = 'domain-tree-entity';
          const childBtn = document.createElement('button');
          childBtn.type = 'button';
          childBtn.className = state.selectedEntityId === entity.id ? 'active' : '';
          const entityName = document.createElement('span');
          entityName.className = 'domain-tree-name';
          entityName.textContent = entity.name;
          childBtn.appendChild(entityName);
          if (isSampleEntity(entity)) {
            const badge = document.createElement('span');
            badge.className = 'sample-badge';
            badge.textContent = 'sample';
            childBtn.appendChild(badge);
          }
          const fieldCount = document.createElement('span');
          fieldCount.className = 'list-meta';
          fieldCount.textContent = `${(entity.fields || []).length}`;
          fieldCount.title = 'Fields';
          childBtn.appendChild(fieldCount);
          childBtn.onclick = () => {
            collapsedDomainIds.delete(domain.id);
            if (typeof setSelectedEntity === 'function') setSelectedEntity(entity.id);
            else focusEntity(entity.id);
          };
          childLi.appendChild(childBtn);

          const entityLinks = (state.relationships || []).filter((rel) => (
            rel.fromEntityId === entity.id || rel.toEntityId === entity.id
          ));
          if (entityLinks.length) {
            const linkList = document.createElement('ul');
            linkList.className = 'domain-tree-links';
            linkList.setAttribute('aria-label', `Links for ${entity.name}`);
            entityLinks.forEach((rel) => {
              const linkLi = document.createElement('li');
              linkLi.className = 'domain-tree-link';
              if (state.selectedRelationshipId === rel.id) linkLi.classList.add('is-selected');
              const linkBtn = document.createElement('button');
              linkBtn.type = 'button';
              linkBtn.className = state.selectedRelationshipId === rel.id ? 'active' : '';
              const otherId = rel.fromEntityId === entity.id ? rel.toEntityId : rel.fromEntityId;
              const outbound = rel.fromEntityId === entity.id;
              linkBtn.textContent = `${outbound ? '→' : '←'} ${entityLabel(state.domains, otherId)} (${rel.fromCardinality}:${rel.toCardinality})`;
              linkBtn.title = relationshipDisplayLabel(rel);
              linkBtn.onclick = (event) => {
                event.stopPropagation();
                collapsedDomainIds.delete(domain.id);
                setSelectedRelationship(rel.id);
              };
              linkLi.appendChild(linkBtn);
              linkList.appendChild(linkLi);
            });
            childLi.appendChild(linkList);
          }

          children.appendChild(childLi);
        });
      }

      li.appendChild(children);
      dom.domainList.appendChild(li);
    });
  }

  function wirePickDomainCta() {
    const cta = document.getElementById('pick-domain-cta');
    if (!cta || cta.dataset.wired === 'true') return;
    cta.dataset.wired = 'true';
    cta.addEventListener('click', () => {
      if (typeof actions.openSidebarGroup === 'function') {
        actions.openSidebarGroup('model');
        return;
      }
      const domainsToggle = document.getElementById('sidebar-group-model-btn');
      if (domainsToggle) domainsToggle.click();
    });
  }

  /**
   * Structure create toolbars — exclusive by selection path (never Domain+Entity together):
   *   none   → Domain create only
   *   domain → Entity create only (gated on that domain)
   *   entity / rel / note → no create strip
   */
  function setCreateToolbarVisible(el, show) {
    if (!el) return;
    el.hidden = !show;
    el.classList.toggle('is-create-inactive', !show);
    el.setAttribute('aria-hidden', String(!show));
    // Inline display beats any stylesheet that overrides [hidden].
    el.style.display = show ? '' : 'none';
  }

  function syncStructureCreateToolbars(kind, domain) {
    const domainCreate = document.getElementById('domain-create-toolbar');
    const entityCreate = document.getElementById('entity-create-toolbar');
    const showDomainCreate = kind === null || kind === 'none';
    // Field scope is under entity — no structure create strip.
    const showEntityCreate = kind === 'domain' && Boolean(domain);

    setCreateToolbarVisible(domainCreate, showDomainCreate);
    setCreateToolbarVisible(entityCreate, showEntityCreate);
    if (entityCreate) {
      entityCreate.dataset.gateReady = String(showEntityCreate);
      entityCreate.setAttribute('aria-disabled', String(!showEntityCreate));
      ['input', 'button', 'select'].forEach((tag) => {
        entityCreate.querySelectorAll(tag).forEach((control) => {
          control.disabled = !showEntityCreate;
        });
      });
      const entityInput = document.getElementById('entity-name-input');
      if (entityInput && domain) {
        entityInput.placeholder = `New entity in ${domain.name}`;
      }
    }
    const structureToolbar = document.getElementById('structure-create-toolbar');
    if (structureToolbar) {
      const showStrip = showDomainCreate || showEntityCreate;
      structureToolbar.hidden = !showStrip;
      structureToolbar.classList.toggle('is-create-inactive', !showStrip);
      structureToolbar.style.display = showStrip ? '' : 'none';
      structureToolbar.dataset.createScope = showEntityCreate ? 'entity' : showDomainCreate ? 'domain' : 'none';
    }
  }

  function renderEntityList() {
    wirePickDomainCta();
    renderDomainList();
    const domain = state.domains.find((entry) => entry.id === state.selectedDomainId) || null;
    syncStructureCreateToolbars(activeInspectorKind(), domain);
  }

  function activeInspectorKind() {
    if (state.selectedNoteId) return 'note';
    if (state.selectedRelationshipId) return 'relationship';
    if (
      state.selection?.kind === 'field'
      && state.selectedEntityId
      && state.selection.fieldName
    ) {
      return 'field';
    }
    if (state.selectedEntityId) return 'entity';
    if (state.selectedDomainId) return 'domain';
    return null;
  }

  function selectedFieldName() {
    return activeInspectorKind() === 'field'
      ? String(state.selection?.fieldName || '').trim() || null
      : null;
  }

  /**
   * One path label on the Domains tab; browse=tree, edit=one inspector.
   */
  function updateShellChrome(kind, selectedDomain) {
    const domainsContext = document.getElementById('sidebar-group-model-context');
    const domainsShell = document.querySelector('.sidebar-shell[data-shell="model"], .sidebar-shell[data-shell="domains"]');
    const domainTitle = document.getElementById('domain-inspector-title');
    const domainsHint = document.getElementById('domains-catalog-hint');
    const scopeEdit = document.getElementById('jx-scope-edit');
    const modelScopePath = document.getElementById('model-scope-path');
    const canvasScopePath = document.getElementById('canvas-scope-path');
    const entityHit = (kind === 'entity' || kind === 'field')
      ? state.domains
        .flatMap((domain) => domain.entities.map((entity) => ({ domain, entity })))
        .find((entry) => entry.entity.id === state.selectedEntityId)
      : null;
    const fieldName = kind === 'field' ? selectedFieldName() : null;

    let pathLabel = 'Nothing selected';
    if (kind === 'field' && entityHit && fieldName) {
      pathLabel = `Field · ${entityHit.domain.name} → ${entityHit.entity.name} → ${fieldName}`;
    } else if (kind === 'entity' && entityHit) {
      pathLabel = `Entity · ${entityHit.domain.name} → ${entityHit.entity.name}`;
    } else if (kind === 'domain' && selectedDomain) {
      pathLabel = `Domain · ${selectedDomain.name}`;
    } else if (kind === 'relationship') {
      const rel = state.relationships.find((entry) => entry.id === state.selectedRelationshipId);
      if (rel) {
        const fromHit = state.domains
          .flatMap((domain) => domain.entities.map((entity) => ({ domain, entity })))
          .find((entry) => entry.entity.id === rel.fromEntityId);
        const toHit = state.domains
          .flatMap((domain) => domain.entities.map((entity) => ({ domain, entity })))
          .find((entry) => entry.entity.id === rel.toEntityId);
        const fromName = fromHit ? `${fromHit.entity.name}${rel.fromField ? `.${rel.fromField}` : ''}` : rel.fromEntityId;
        const toName = toHit ? `${toHit.entity.name}${rel.toField ? `.${rel.toField}` : ''}` : rel.toEntityId;
        pathLabel = `Rel · ${fromName} → ${toName}`;
      } else {
        pathLabel = 'Relationship';
      }
    } else if (kind === 'note') {
      const note = (state.notes || []).find((entry) => entry.id === state.selectedNoteId);
      const preview = String(note?.text || '').trim().slice(0, 28);
      pathLabel = preview ? `Note · ${preview}` : 'Note';
    } else if (state.domains.length) {
      pathLabel = `${state.domains.length} domains`;
    }

    if (domainsContext) {
      if (kind === 'field' && entityHit && fieldName) {
        domainsContext.textContent = `${entityHit.entity.name} → ${fieldName}`;
      } else if (kind === 'entity' && entityHit) {
        domainsContext.textContent = `${entityHit.domain.name} → ${entityHit.entity.name}`;
      } else if (selectedDomain) {
        domainsContext.textContent = selectedDomain.name;
      } else {
        domainsContext.textContent = String(state.domains.length);
      }
    }
    if (modelScopePath) modelScopePath.textContent = pathLabel;
    if (canvasScopePath) canvasScopePath.textContent = pathLabel;
    if (domainsShell) {
      const editing = Boolean(kind);
      domainsShell.dataset.shellMode = editing ? 'editing' : 'catalog';
      domainsShell.dataset.selectionKind = kind || 'none';
    }
    if (domainTitle) {
      domainTitle.hidden = kind === 'domain' && Boolean(selectedDomain);
    }
    if (domainsHint) {
      domainsHint.hidden = Boolean(kind);
      if (!kind) {
        domainsHint.textContent = state.domains.length
          ? 'Select a domain or entity in the tree to edit below.'
          : 'Add a domain to start modeling.';
      }
    }
    const browseLabel = document.getElementById('jx-scope-browse-label');
    if (browseLabel) {
      browseLabel.textContent = kind ? 'Browse' : 'Browse · pick a domain or entity';
    }
    const editLabel = document.getElementById('jx-scope-edit-label');
    if (editLabel) {
      if (kind === 'domain') editLabel.textContent = 'Edit · Domain';
      else if (kind === 'field') editLabel.textContent = 'Edit · Field';
      else if (kind === 'entity') editLabel.textContent = 'Edit · Entity';
      else if (kind === 'relationship') editLabel.textContent = 'Relationship';
      else if (kind === 'note') editLabel.textContent = 'Edit · Note';
      else editLabel.textContent = 'Edit';
    }
    if (scopeEdit) {
      scopeEdit.dataset.editKind = kind || 'none';
      scopeEdit.hidden = !kind;
    }
    syncStructureCreateToolbars(kind, selectedDomain);
  }

  function syncInspectorPanelVisibility() {
    const kind = activeInspectorKind();
    const panels = [
      ['domain-inspector-panel', 'domain'],
      ['entity-inspector-panel', 'entity'],
      ['relationship-inspector-panel', 'relationship'],
      ['note-inspector-panel', 'note']
    ];
    panels.forEach(([id, panelKind]) => {
      const panel = document.getElementById(id);
      if (!panel) return;
      // Field edit reuses the entity panel with a narrowed surface.
      const active = kind === panelKind || (panelKind === 'entity' && kind === 'field');
      panel.hidden = !active;
      panel.classList.toggle('is-deferred', !active);
      if (id === 'entity-inspector-panel') {
        panel.classList.toggle('is-field-scope', kind === 'field');
        panel.dataset.editScope = kind === 'field' ? 'field' : (kind === 'entity' ? 'entity' : 'none');
      }
    });

    const domainsCatalog = document.getElementById('domains-catalog-panel');
    if (domainsCatalog) {
      domainsCatalog.hidden = false;
      domainsCatalog.classList.toggle('is-shell-secondary', Boolean(kind));
    }
    const entitiesCatalog = document.getElementById('entities-catalog-panel');
    if (entitiesCatalog) {
      entitiesCatalog.hidden = true;
    }

    const workspace = document.getElementById('entities-workspace');
    const domain = getSelectedDomain();
    const showEntityScope = kind === 'entity' || kind === 'field' || kind === 'relationship' || kind === 'note';
    if (workspace) {
      const ready = Boolean(domain);
      workspace.dataset.gateReady = String(ready);
      workspace.classList.toggle('is-gate-blocked', !ready);
      workspace.setAttribute('aria-disabled', String(!ready));
      workspace.hidden = !showEntityScope;
      const gate = document.getElementById('entities-workspace-gate');
      if (gate) gate.hidden = true;
      const body = document.getElementById('entities-workspace-body');
      if (body) body.hidden = !showEntityScope;
    }
    const pickCta = document.getElementById('pick-domain-cta');
    if (pickCta) pickCta.hidden = true;

    updateShellChrome(kind, domain);
    renderEntityList();
  }

  const DOMAIN_PANES = ['identity', 'context'];
  let chosenDomainPane = 'identity';

  function setDomainInspectorPane(pane) {
    if (!DOMAIN_PANES.includes(pane)) return;
    chosenDomainPane = pane;
    const panel = document.getElementById('domain-inspector-panel');
    if (!panel) return;
    panel.querySelectorAll('[data-domain-pane-tab]').forEach((tab) => {
      const isActive = tab.dataset.domainPaneTab === pane;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });
    panel.querySelectorAll('[data-domain-pane]').forEach((section) => {
      section.hidden = section.dataset.domainPane !== pane;
    });
  }

  function wireDomainInspectorPanes() {
    const panel = document.getElementById('domain-inspector-panel');
    if (!panel || panel.dataset.domainPanesWired === 'true') return;
    panel.dataset.domainPanesWired = 'true';
    const tabs = Array.from(panel.querySelectorAll('[data-domain-pane-tab]'));
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => setDomainInspectorPane(tab.dataset.domainPaneTab));
      tab.addEventListener('keydown', (event) => {
        let nextIndex = null;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        event.stopPropagation();
        const next = tabs[nextIndex];
        setDomainInspectorPane(next.dataset.domainPaneTab);
        next.focus();
      });
    });
    setDomainInspectorPane(DOMAIN_PANES.includes(chosenDomainPane) ? chosenDomainPane : 'identity');
  }

  function syncDomainInspectorEditMode(selected) {
    wireDomainInspectorPanes();
    const panel = document.getElementById('domain-inspector-panel');
    const titleEl = document.getElementById('domain-inspector-title');
    const body = document.getElementById('domain-inspector-body');
    const editingDomain = activeInspectorKind() === 'domain' && Boolean(selected);
    if (panel) {
      panel.classList.toggle('is-editing', editingDomain);
      panel.classList.toggle('is-empty', !editingDomain);
      panel.setAttribute(
        'aria-label',
        editingDomain
          ? `Editing domain ${selected.name}`
          : 'Domain inspector — no domain selected'
      );
    }
    if (titleEl) {
      titleEl.textContent = editingDomain ? selected.name : 'Domain';
    }
    if (body) body.hidden = !editingDomain;
    if (dom.domainRenameInput) {
      const renameFocused = document.activeElement === dom.domainRenameInput;
      if (!renameFocused) {
        dom.domainRenameInput.value = editingDomain ? selected.name : '';
      }
      dom.domainRenameInput.disabled = !editingDomain;
    }
    if (dom.renameDomainBtn) dom.renameDomainBtn.disabled = !editingDomain;
    if (dom.deleteDomainBtn) dom.deleteDomainBtn.disabled = !editingDomain;
    if (dom.setDomainColorBtn) dom.setDomainColorBtn.disabled = !editingDomain;
    if (dom.domainColorInput) dom.domainColorInput.disabled = !editingDomain;
  }

  function renderStatus() {
    const selected = getSelectedDomain();
    syncDomainInspectorEditMode(selected);
    syncInspectorPanelVisibility();
    const kind = activeInspectorKind();
    if (kind === 'note') {
      dom.status.textContent = 'Selected note';
    } else if (kind === 'relationship') {
      const relationship = state.relationships.find((candidate) => candidate.id === state.selectedRelationshipId);
      dom.status.textContent = relationship
        ? `Selected relationship: ${relationship.name || relationship.id}`
        : 'No relationship selected';
    } else if (kind === 'entity') {
      const found = state.domains
        .flatMap((domain) => domain.entities.map((entity) => ({ domain, entity })))
        .find((entry) => entry.entity.id === state.selectedEntityId);
      dom.status.textContent = found
        ? `Selected entity: ${found.domain.name} / ${found.entity.name}`
        : 'No entity selected';
    } else {
      dom.status.textContent = selected ? `Selected domain: ${selected.name}` : 'No domain selected';
    }
    if (dom.domainColorInput && document.activeElement !== dom.domainColorInput) {
      dom.domainColorInput.value = selected?.color || '#60a5fa';
    }
    const context = selected?.context || {};
    const editingDomain = kind === 'domain' && Boolean(selected);
    writeDomainContextForm(context, {
      disabled: !editingDomain,
      selectedDomainName: selected?.name || '',
      domainId: editingDomain ? selected.id : null
    });
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

  function relationshipDisplayLabel(relationship) {
    const from = entityLabel(state.domains, relationship.fromEntityId);
    const to = entityLabel(state.domains, relationship.toEntityId);
    const card = `${relationship.fromCardinality || '1'}:${relationship.toCardinality || '1'}`;
    const name = String(relationship.name || '').trim();
    return name ? `${name} · ${from} ${card} ${to}` : `${from} ${card} ${to}`;
  }

  function relationshipPathMeta(relationship) {
    const from = entityLabel(state.domains, relationship.fromEntityId);
    const to = entityLabel(state.domains, relationship.toEntityId);
    const card = `${relationship.fromCardinality || '1'}:${relationship.toCardinality || '1'}`;
    return `${from} ${card} ${to}`;
  }

  function relationshipLinkParts(relationship) {
    const meta = relationshipPathMeta(relationship);
    const name = String(relationship.name || '').trim();
    return {
      title: name || meta,
      meta: name ? meta : ''
    };
  }

  function relationshipScopeEntityLabel(scope) {
    const selected = scope.find((rel) => rel.id === state.selectedRelationshipId) || scope[0];
    if (!selected) return '';
    if (state.selectedEntityId) {
      return entityLabel(state.domains, state.selectedEntityId);
    }
    const fromId = selected.fromEntityId;
    const toId = selected.toEntityId;
    // Prefer the entity that owns the majority of scoped links (from side).
    const fromCount = scope.filter((rel) => rel.fromEntityId === fromId || rel.toEntityId === fromId).length;
    const toCount = scope.filter((rel) => rel.fromEntityId === toId || rel.toEntityId === toId).length;
    return entityLabel(state.domains, fromCount >= toCount ? fromId : toId);
  }

  function syncRelationshipBrowseHint(scope) {
    const hint = document.getElementById('relationship-browse-hint');
    if (!hint) return;
    const total = scope.length;
    const current = scope.findIndex((rel) => rel.id === state.selectedRelationshipId);
    if (!total || current < 0) {
      hint.hidden = true;
      hint.textContent = '';
      return;
    }
    const entityName = relationshipScopeEntityLabel(scope);
    const shortEntity = String(entityName || '').split('/').pop()?.trim() || entityName || 'entity';
    hint.hidden = false;
    hint.textContent = `Link ${current + 1} of ${total} on ${shortEntity}`;
  }

  function renderRelationshipList() {
    if (!dom.relationshipList) return;
    dom.relationshipList.innerHTML = '';
    const scope = typeof relationshipsInNavScope === 'function'
      ? relationshipsInNavScope()
      : (state.relationships || []);
    syncRelationshipBrowseHint(scope);
    if (!scope.length) {
      const empty = document.createElement('li');
      empty.className = 'relationship-item is-empty';
      empty.textContent = 'No related links yet.';
      dom.relationshipList.appendChild(empty);
      return;
    }
    scope.forEach((relationship) => {
      const li = document.createElement('li');
      li.className = 'relationship-item';
      if (state.selectedRelationshipId === relationship.id) li.classList.add('is-selected');
      const parts = relationshipLinkParts(relationship);
      const fullLabel = relationshipDisplayLabel(relationship);
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'relationship-name';
      name.title = fullLabel;
      const titleEl = document.createElement('span');
      titleEl.className = 'relationship-name-title';
      titleEl.textContent = parts.title;
      name.appendChild(titleEl);
      if (parts.meta) {
        const metaEl = document.createElement('span');
        metaEl.className = 'relationship-name-meta';
        metaEl.textContent = parts.meta;
        name.appendChild(metaEl);
      }
      name.onclick = () => setSelectedRelationship(relationship.id);
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'relationship-delete';
      del.title = 'Remove link';
      del.setAttribute('aria-label', `Remove link: ${parts.title}`);
      del.textContent = '×';
      del.onclick = () => deleteRelationship(relationship.id);
      li.appendChild(name);
      li.appendChild(del);
      dom.relationshipList.appendChild(li);
    });
  }

  let lastRelationshipIdForAdvanced = null;

  function syncRelationshipInspector() {
    const panel = document.getElementById('relationship-inspector-panel');
    const modeEl = document.getElementById('relationship-inspector-mode');
    const titleEl = document.getElementById('relationship-inspector-title');
    const body = document.getElementById('relationship-inspector-body');
    const create = panel?.querySelector('[data-relationship-section="create"]');
    const browse = panel?.querySelector('[data-relationship-section="browse"]');
    const relationship = state.relationships.find((candidate) => candidate.id === state.selectedRelationshipId);
    const editingRelationship = activeInspectorKind() === 'relationship' && Boolean(relationship);
    renderRelationshipList();
    if (panel) {
      panel.classList.toggle('is-editing', editingRelationship);
      panel.classList.toggle('is-empty', !editingRelationship);
      panel.setAttribute(
        'aria-label',
        editingRelationship
          ? `Editing relationship ${relationship.name || relationship.id}`
          : 'Relationship inspector — no relationship selected'
      );
    }
    if (modeEl) modeEl.textContent = 'Relationship';
    if (titleEl) {
      // Name lives in the editable field — chrome only prompts when empty.
      titleEl.textContent = editingRelationship
        ? ''
        : 'Select a link on the canvas or in the tree';
      titleEl.hidden = editingRelationship;
    }
    const chrome = panel?.querySelector('.relationship-inspector-chrome');
    // Outer "Relationship" label is enough while editing — hide empty chrome bar.
    if (chrome) chrome.hidden = editingRelationship;
    if (body) body.hidden = !editingRelationship;
    if (create) create.hidden = editingRelationship;
    // Edit card is ONLY the current relationship — tree owns link browsing.
    if (browse) browse.hidden = editingRelationship;
    const advanced = body?.querySelector('details.relationship-advanced');
    const selectedId = editingRelationship ? relationship.id : null;
    if (advanced && selectedId !== lastRelationshipIdForAdvanced) {
      advanced.open = false;
      lastRelationshipIdForAdvanced = selectedId;
    }
    const disabled = !editingRelationship;
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
    if (dom.deleteRelationshipBtn) dom.deleteRelationshipBtn.disabled = disabled;
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
    if (document.activeElement !== dom.relationshipNameInput) {
      dom.relationshipNameInput.value = relationship.name || '';
    }
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

  function syncNoteInspector() {
    const panel = document.getElementById('note-inspector-panel');
    const modeEl = document.getElementById('note-inspector-mode');
    const titleEl = document.getElementById('note-inspector-title');
    const body = document.getElementById('note-inspector-body');
    const note = (state.notes || []).find((candidate) => candidate.id === state.selectedNoteId);
    const editingNote = activeInspectorKind() === 'note' && Boolean(note);
    if (panel) {
      panel.classList.toggle('is-editing', editingNote);
      panel.classList.toggle('is-empty', !editingNote);
      panel.setAttribute(
        'aria-label',
        editingNote ? 'Editing note' : 'Note inspector — no note selected'
      );
    }
    if (modeEl) modeEl.textContent = editingNote ? 'Editing note' : 'No selection';
    if (titleEl) {
      titleEl.textContent = editingNote
        ? (note.text || 'Untitled note').split('\n')[0].slice(0, 48) || 'Untitled note'
        : 'Click a note on the canvas to edit it here.';
    }
    if (body) body.hidden = !editingNote;
    if (dom.noteTextInput) {
      const focused = document.activeElement === dom.noteTextInput;
      if (!focused) dom.noteTextInput.value = editingNote ? (note.text || '') : '';
      dom.noteTextInput.disabled = !editingNote;
    }
    if (dom.noteColorInput) {
      if (document.activeElement !== dom.noteColorInput) {
        dom.noteColorInput.value = editingNote ? (note.color || '#fde68a') : '#fde68a';
      }
      dom.noteColorInput.disabled = !editingNote;
    }
    if (dom.saveNoteBtn) dom.saveNoteBtn.disabled = !editingNote;
    if (dom.deleteNoteBtn) dom.deleteNoteBtn.disabled = !editingNote;
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

  const ENTITY_PANES = ['fields', 'rules', 'rbac', 'contracts', 'advanced'];
  let chosenEntityPane = 'fields';
  let lastSelectedEntityIdForPane = null;

  function activeEntityPane() {
    return ENTITY_PANES.includes(chosenEntityPane) ? chosenEntityPane : 'fields';
  }

  function setEntityInspectorPane(pane) {
    if (!ENTITY_PANES.includes(pane)) return;
    chosenEntityPane = pane;
    const panel = document.getElementById('entity-inspector-panel');
    if (!panel) return;
    panel.querySelectorAll('[data-entity-pane-tab]').forEach((tab) => {
      const isActive = tab.dataset.entityPaneTab === pane;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });
    panel.querySelectorAll('[data-entity-pane]').forEach((section) => {
      section.hidden = section.dataset.entityPane !== pane;
    });
  }

  function wireEntityInspectorPanes() {
    const panel = document.getElementById('entity-inspector-panel');
    if (!panel || panel.dataset.entityPanesWired === 'true') return;
    panel.dataset.entityPanesWired = 'true';
    const tabs = Array.from(panel.querySelectorAll('[data-entity-pane-tab]'));
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => setEntityInspectorPane(tab.dataset.entityPaneTab));
      tab.addEventListener('keydown', (event) => {
        let nextIndex = null;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        event.stopPropagation();
        const next = tabs[nextIndex];
        setEntityInspectorPane(next.dataset.entityPaneTab);
        next.focus();
      });
    });
    setEntityInspectorPane(activeEntityPane());
  }

  function syncEntityInspectorEditMode(found) {
    wireEntityInspectorPanes();
    const panel = document.getElementById('entity-inspector-panel');
    const modeEl = document.getElementById('entity-inspector-mode');
    const body = document.getElementById('entity-inspector-body');
    const kind = activeInspectorKind();
    const editingEntity = kind === 'entity' && Boolean(found);
    const editingField = kind === 'field' && Boolean(found) && Boolean(selectedFieldName());
    const editing = editingEntity || editingField;
    if (panel) {
      panel.classList.toggle('is-editing', editing);
      panel.classList.toggle('is-empty', !editing);
      panel.classList.toggle('is-field-scope', editingField);
      panel.dataset.editScope = editingField ? 'field' : (editingEntity ? 'entity' : 'none');
      panel.setAttribute('aria-busy', 'false');
      panel.setAttribute(
        'aria-label',
        editingField
          ? `Editing field ${found.domain.name} / ${found.entity.name} / ${selectedFieldName()}`
          : editingEntity
            ? `Editing entity ${found.domain.name} / ${found.entity.name}`
            : 'Entity inspector — no entity selected'
      );
    }
    if (modeEl) {
      modeEl.hidden = true;
      modeEl.textContent = editingField ? 'Field' : editingEntity ? 'Entity' : 'No selection';
    }
    if (body) body.hidden = !editing;
    // Field scope always shows Fields pane; entity switch resets to Fields.
    const selectedId = editing ? found.entity.id : null;
    if (editingField || (selectedId && selectedId !== lastSelectedEntityIdForPane)) {
      setEntityInspectorPane('fields');
    }
    lastSelectedEntityIdForPane = selectedId;
    if (!editing) setEntityInspectorPane('fields');
  }

  function renderEntityInspector() {
    const found = findEntity(state.domains, state.selectedEntityId);
    dom.entityFieldList.innerHTML = '';
    dom.entityApiPreviewList.innerHTML = '';
    syncEntityInspectorEditMode(found);
    if (!found) {
      dom.entityInspectorTitle.textContent = 'Select an entity in the list';
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
    const fieldFocus = selectedFieldName();
    const fieldScope = activeInspectorKind() === 'field' && Boolean(fieldFocus);
    dom.entityInspectorTitle.textContent = fieldScope
      ? `${found.domain.name} / ${found.entity.name} · ${fieldFocus}`
      : `${found.domain.name} / ${found.entity.name}`;
    dom.entityRenameInput.value = found.entity.name;
    dom.entityRenameInput.disabled = fieldScope;
    dom.saveEntityRenameBtn.disabled = fieldScope;
    dom.duplicateEntityBtn.disabled = fieldScope;
    dom.entityMoveDomainSelect.disabled = fieldScope;
    dom.moveEntityBtn.disabled = fieldScope;
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
    dom.fieldTemplateSelect.disabled = fieldScope;
    dom.applyFieldTemplateBtn.disabled = fieldScope;
    dom.entityMoveDomainSelect.value = found.domain.id;
    const fieldsToEdit = fieldScope
      ? (found.entity.fields || []).filter((field) => field.name === fieldFocus)
      : (found.entity.fields || []);
    if (fieldScope && !fieldsToEdit.length) {
      const empty = document.createElement('li');
      empty.className = 'field-row is-empty';
      empty.textContent = `Field "${fieldFocus}" is not on this entity.`;
      dom.entityFieldList.appendChild(empty);
    }
    fieldsToEdit.forEach((field) => {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = fieldScope ? 'field-row is-field-focus' : 'field-row';
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
      const indexedCheck = document.createElement('input');
      indexedCheck.type = 'checkbox';
      indexedCheck.checked = Boolean(field.indexed);
      indexedCheck.title = 'indexed';
      indexedCheck.setAttribute('aria-label', `Indexed — ${fieldLabel}`);
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
        indexed: indexedCheck.checked,
        nullable: nullableCheck.checked
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'x';
      del.setAttribute('aria-label', `Delete ${fieldLabel}`);
      del.onclick = () => removeField(found.entity.id, field.name);
      // Two-line row: name/type/actions on top, flag chips below — a single
      // 11-track grid was wider than the Domain Designer drawer and clipped.
      const primary = document.createElement('div');
      primary.className = 'field-row-primary';
      primary.appendChild(nameInput);
      primary.appendChild(typeSelect);
      const actions = document.createElement('div');
      actions.className = 'field-row-actions';
      actions.appendChild(meta);
      actions.appendChild(save);
      actions.appendChild(del);
      primary.appendChild(actions);
      const flags = document.createElement('div');
      flags.className = 'field-row-flags';
      flags.setAttribute('role', 'group');
      flags.setAttribute('aria-label', `Flags for ${fieldLabel}`);
      const flagDefs = [
        [requiredCheck, 'req'],
        [pkCheck, 'PK'],
        [fkCheck, 'FK'],
        [uniqueCheck, 'uniq'],
        [indexedCheck, 'idx'],
        [nullableCheck, 'null']
      ];
      flagDefs.forEach(([input, label]) => {
        const chip = document.createElement('label');
        chip.className = 'flag-chip';
        chip.appendChild(input);
        chip.appendChild(document.createTextNode(` ${label}`));
        flags.appendChild(chip);
      });
      row.appendChild(primary);
      row.appendChild(flags);
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
    renderEntityList,
    renderStatus,
    renderEntityOptions,
    renderRelationshipList,
    syncRelationshipInspector,
    syncNoteInspector,
    syncInspectorPanelVisibility,
    syncDomainIntegrationChannelOther,
    readDomainContextForm,
    clearDomainContextForm,
    isDomainContextHydrating: () => domainContextHydrating,
    refreshDomainContextForm: () => {
      const selected = getSelectedDomain();
      writeDomainContextForm(selected?.context || {}, {
        disabled: !(selected && !state.selectedEntityId && !state.selectedRelationshipId && !state.selectedNoteId),
        selectedDomainName: selected?.name || '',
        domainId: selected?.id || null,
        force: true
      });
    },
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
