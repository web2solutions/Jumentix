/**
 * architectureCanvas — Architecture tab (JUM-816).
 * Canvas-first: drag domains onto services, Connect click-to-click for links,
 * inspector shows the selected service without opaque “magic” forms.
 *
 * Model fact (designer-core normalize): every domain lives on exactly one
 * service; orphans are reassigned to Core. UI copy must say “move”, never “free”.
 */

import {
  addArchitectureLink,
  addArchitectureService,
  ARCHITECTURE_LINK_PROTOCOLS,
  assignDomainToService,
  normalizeArchitectureInput,
  removeArchitectureService
} from '@jumentix/designer-core/model/architecture.js';
import { collectArchitectureIssues } from '@jumentix/designer-core/validation/architectureValidation.js';

/**
 * A link joins the facing edges of two service cards at mid-height. The line
 * used to run centre-to-centre at `y + 20`, straight through both titles
 * (JUM-905).
 */
export function architectureLinkGeometry(from, to) {
  const [left, right] = from.x <= to.x ? [from, to] : [to, from];
  return {
    x1: left.x + left.width,
    y1: left.y + left.height / 2,
    x2: right.x,
    y2: right.y + right.height / 2
  };
}

/** Link list entries name services instead of internal ids like `service-import-2` (JUM-905). */
export function architectureLinkLabel(link, services) {
  const nameOf = (id) => services.find((service) => service.id === id)?.name || id;
  return `${nameOf(link.from)} —${link.protocol}→ ${nameOf(link.to)}`;
}

const ARCHITECTURE_PANEL_KEYS = ['services', 'domains', 'selected', 'links', 'validate'];
const COACH_DISMISS_KEY = 'jumentix.architecture.coachDismissed';
const RAIL_PREF_KEY = 'jumentix.architecture.railOpen';
/** Below this stage/viewport width the rail closes so the canvas stays evident. */
const RAIL_NARROW_PX = 1100;

/**
 * @param {Object} options
 * @param {Object} options.dom
 * @param {Object} options.state
 * @param {Object} options.actions
 * @param {{ ownEmptyState?: boolean, ownCoach?: boolean }} [options.chrome]
 *        When true, ArchitectureTab child Components own empty/coach chrome —
 *        this factory skips those DOM writes and dismiss wiring.
 */
export function createArchitectureCanvas({ dom, state, actions, chrome = {} }) {
  const { withPersist, saveState } = actions;
  const ownEmptyState = Boolean(chrome.ownEmptyState);
  const ownCoach = Boolean(chrome.ownCoach);
  /** @type {{ active: boolean, fromId: string | null }} */
  let connectMode = { active: false, fromId: null };
  let activePanel = 'services';
  let coachDismissed = false;
  if (!ownCoach) {
    try {
      coachDismissed = typeof localStorage !== 'undefined'
        && localStorage.getItem(COACH_DISMISS_KEY) === '1';
    } catch {
      coachDismissed = false;
    }
  }

  function architecture() {
    state.architecture = normalizeArchitectureInput(state.architecture, state.domains);
    return state.architecture;
  }

  function stageWidth() {
    const shell = dom.architectureSidebar?.closest?.('.architecture-shell')
      || dom.architectureSidebar?.parentElement
      || null;
    const stage = shell?.closest?.('.service-management-stage') || shell?.parentElement || null;
    const width = stage?.clientWidth || shell?.clientWidth || 0;
    if (width > 0) return width;
    if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
      return window.innerWidth;
    }
    return RAIL_NARROW_PX + 1;
  }

  function isNarrowStage() {
    return stageWidth() < RAIL_NARROW_PX;
  }

  function readRailPreference() {
    try {
      const stored = typeof localStorage !== 'undefined'
        ? localStorage.getItem(RAIL_PREF_KEY)
        : null;
      if (stored === '0') return false;
      if (stored === '1') return true;
    } catch {
      /* ignore */
    }
    // Default contracted (hamburger-style) — canvas stays full-bleed until Show.
    return false;
  }

  function writeRailPreference(open) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(RAIL_PREF_KEY, open ? '1' : '0');
      }
    } catch {
      /* ignore quota */
    }
  }

  /**
   * @param {boolean} open
   * @param {{ persist?: boolean }} [options]
   */
  function setArchitectureSidebarOpen(open, options = {}) {
    const persist = options.persist !== false;
    const sidebar = dom.architectureSidebar;
    const shell = sidebar?.closest?.('.architecture-shell') || sidebar?.parentElement;
    if (sidebar) sidebar.classList.toggle('open', open);
    if (dom.architectureToggleSidebarBtn) {
      dom.architectureToggleSidebarBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      dom.architectureToggleSidebarBtn.textContent = open ? 'Hide' : 'Panels';
      dom.architectureToggleSidebarBtn.title = open ? 'Hide panels' : 'Show panels (P)';
    }
    if (shell) shell.classList.toggle('architecture-rail-open', open);
    if (persist) writeRailPreference(open);
  }

  /** Auto-close on narrow stages; never auto-reopen (user must Show). */
  function syncRailToViewport() {
    if (!isNarrowStage()) return;
    if (dom.architectureSidebar?.classList.contains('open')) {
      setArchitectureSidebarOpen(false, { persist: false });
    }
  }

  function revealArchitecturePanel(key) {
    if (!ARCHITECTURE_PANEL_KEYS.includes(key)) return;
    activePanel = key;
    const root = typeof document !== 'undefined' && typeof document.querySelector === 'function'
      ? document
      : null;
    ARCHITECTURE_PANEL_KEYS.forEach((panelKey) => {
      const cell = root?.querySelector(`[data-architecture-group="${panelKey}"]`);
      const tab = root?.querySelector(`[data-architecture-tab="${panelKey}"]`);
      const body = cell?.querySelector?.('.sidebar-accordion-body');
      const on = panelKey === key;
      if (cell) {
        cell.hidden = !on;
        if (cell.dataset) cell.dataset.accordionExpanded = on ? 'true' : 'false';
      }
      if (body) body.hidden = !on;
      if (tab) {
        tab.classList?.toggle?.('active', on);
        tab.setAttribute?.('aria-selected', on ? 'true' : 'false');
      }
    });
    setArchitectureSidebarOpen(true);
  }

  function serviceRoleLabel(service) {
    return service?.kind === 'core' ? 'Core' : 'Split-out';
  }

  function syncScopePath() {
    const selected = selectedService();
    const path = selected
      ? `${selected.name} · ${serviceRoleLabel(selected)} · ${selected.domains.length} domain${selected.domains.length === 1 ? '' : 's'}`
      : 'Nothing selected — click a card';
    if (dom.architectureScopePath) dom.architectureScopePath.textContent = path;
  }

  function syncPanelBadges() {
    const arch = architecture();
    const selected = selectedService();
    const issues = collectArchitectureIssues(state);
    const errorCount = issues.filter((issue) => issue.severity === 'error').length;
    if (dom.architectureTabServicesContext) {
      dom.architectureTabServicesContext.textContent = String(arch.services.length);
    }
    if (dom.architectureTabDomainsContext) {
      dom.architectureTabDomainsContext.textContent = String((state.domains || []).length);
    }
    if (dom.architectureTabSelectedContext) {
      const label = selected?.name || '—';
      dom.architectureTabSelectedContext.textContent = label.length > 10 ? `${label.slice(0, 9)}…` : label;
      dom.architectureTabSelectedContext.title = selected?.name || 'No service selected';
    }
    if (dom.architectureTabLinksContext) {
      dom.architectureTabLinksContext.textContent = String(arch.links.length);
    }
    if (dom.architectureTabValidateContext) {
      dom.architectureTabValidateContext.textContent = String(errorCount || issues.length);
      dom.architectureTabValidateContext.dataset.severity = errorCount ? 'error' : (issues.length ? 'warn' : 'ok');
    }
  }

  function truncateLabel(value, max = 18) {
    const text = String(value || '');
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function domainById(id) {
    return (state.domains || []).find((domain) => domain.id === id);
  }

  function hostServiceForDomain(domainId) {
    return architecture().services.find((service) => service.domains.includes(domainId)) || null;
  }

  function selectedService() {
    const arch = architecture();
    if (state.selectedArchitectureServiceId) {
      const found = arch.services.find((service) => service.id === state.selectedArchitectureServiceId);
      if (found) return found;
    }
    // Default selection = first service (usually Core). Path chrome shows its name —
    // never the lying “Nothing selected” while a card is the active default.
    const fallback = arch.services[0] || null;
    if (fallback) state.selectedArchitectureServiceId = fallback.id;
    return fallback;
  }

  function domainsOnOtherServices(serviceId) {
    return (state.domains || []).filter((domain) => {
      const host = hostServiceForDomain(domain.id);
      return host && host.id !== serviceId;
    });
  }

  function setConnectStatus(message) {
    if (dom.architectureConnectStatus) dom.architectureConnectStatus.textContent = message || '';
  }

  function idleConnectHint() {
    return 'Tip: Connect → click source card → click target. Esc cancels.';
  }

  function syncConnectChrome() {
    if (dom.architectureConnectBtn) {
      dom.architectureConnectBtn.setAttribute('aria-pressed', connectMode.active ? 'true' : 'false');
      dom.architectureConnectBtn.classList.toggle('is-active', connectMode.active);
      dom.architectureConnectBtn.textContent = connectMode.active ? 'Connecting…' : 'Connect';
    }
    if (dom.architectureCancelConnectBtn) {
      dom.architectureCancelConnectBtn.hidden = !connectMode.active;
    }
    if (dom.architectureCanvas) {
      dom.architectureCanvas.classList.toggle('is-connecting', connectMode.active);
    }
    if (!connectMode.active) {
      setConnectStatus((state.domains || []).length ? idleConnectHint() : '');
      return;
    }
    if (!connectMode.fromId) {
      setConnectStatus('Step 1/2: click the source service card.');
      return;
    }
    const from = architecture().services.find((service) => service.id === connectMode.fromId);
    setConnectStatus(`Step 2/2: click the target (from “${from?.name || connectMode.fromId}”). Protocol = ${protocolValue()}.`);
  }

  function stopConnectMode() {
    connectMode = { active: false, fromId: null };
    syncConnectChrome();
    renderCanvas();
  }

  function startConnectMode() {
    connectMode = { active: true, fromId: null };
    syncConnectChrome();
    renderCanvas();
  }

  function protocolValue() {
    const raw = dom.architectureLinkProtocol?.value || dom.architectureLinkProtocolPanel?.value;
    return ARCHITECTURE_LINK_PROTOCOLS.includes(raw) ? raw : 'rest';
  }

  function syncProtocolSelects(source) {
    const value = protocolValue();
    if (dom.architectureLinkProtocol && source !== dom.architectureLinkProtocol) {
      dom.architectureLinkProtocol.value = value;
    }
    if (dom.architectureLinkProtocolPanel && source !== dom.architectureLinkProtocolPanel) {
      dom.architectureLinkProtocolPanel.value = value;
    }
  }

  function handleServiceConnectClick(serviceId) {
    if (!connectMode.active) return false;
    if (!connectMode.fromId) {
      connectMode.fromId = serviceId;
      syncConnectChrome();
      renderCanvas();
      return true;
    }
    if (connectMode.fromId === serviceId) {
      setConnectStatus('Pick a different service as the target.');
      return true;
    }
    withPersist(() => {
      state.architecture = addArchitectureLink(architecture(), {
        from: connectMode.fromId,
        to: serviceId,
        protocol: protocolValue()
      }, state.domains);
    });
    connectMode = { active: false, fromId: null };
    state.selectedArchitectureServiceId = serviceId;
    renderArchitecture();
    return true;
  }

  function moveDomainToCore(domainId) {
    const current = architecture();
    const core = current.services.find((service) => service.kind === 'core') || current.services[0];
    if (!core) return;
    withPersist(() => {
      state.architecture = assignDomainToService(current, domainId, core.id);
    });
    renderArchitecture();
  }

  function hostServiceForNewDomain() {
    return selectedService()
      || architecture().services.find((service) => service.kind === 'core')
      || architecture().services[0]
      || null;
  }

  function setFieldError(input, errorEl, message) {
    const text = String(message || '').trim();
    if (input) {
      input.classList.toggle('is-invalid', Boolean(text));
      input.classList.toggle('is-valid', !text && Boolean(String(input.value || '').trim()));
      input.setAttribute('aria-invalid', text ? 'true' : 'false');
    }
    if (errorEl) {
      errorEl.hidden = !text;
      errorEl.textContent = text;
    }
  }

  function clearFieldError(input, errorEl) {
    setFieldError(input, errorEl, '');
    if (input) input.classList.remove('is-valid');
  }

  function normalizeLabel(value) {
    return String(value || '').trim().replace(/\s+/gu, ' ');
  }

  function isServiceNameTaken(name, ignoredId = null) {
    const needle = normalizeLabel(name).toLowerCase();
    if (!needle) return false;
    return architecture().services.some((service) => {
      if (ignoredId && service.id === ignoredId) return false;
      return normalizeLabel(service.name).toLowerCase() === needle;
    });
  }

  function isDomainNameTakenLocal(name) {
    const needle = normalizeLabel(name).toLowerCase();
    if (!needle) return false;
    return (state.domains || []).some(
      (domain) => normalizeLabel(domain.name).toLowerCase() === needle
    );
  }

  function validateServiceName(raw, { ignoredId = null, required = true } = {}) {
    const name = normalizeLabel(raw);
    if (!name) {
      return required ? { ok: false, message: 'Name is required.' } : { ok: true, name: '' };
    }
    if (name.length < 2) {
      return { ok: false, message: 'Use at least 2 characters.' };
    }
    if (name.length > 64) {
      return { ok: false, message: 'Keep the name under 64 characters.' };
    }
    if (isServiceNameTaken(name, ignoredId)) {
      return { ok: false, message: `“${name}” already exists.` };
    }
    return { ok: true, name };
  }

  function validateDomainName(raw) {
    const name = normalizeLabel(raw);
    if (!name) return { ok: false, message: 'Domain name is required.' };
    if (name.length < 2) return { ok: false, message: 'Use at least 2 characters.' };
    if (name.length > 64) return { ok: false, message: 'Keep the name under 64 characters.' };
    if (isDomainNameTakenLocal(name)) {
      return { ok: false, message: `Domain “${name}” already exists.` };
    }
    return { ok: true, name };
  }

  function validateServiceUrl(raw, { allowEmpty = true } = {}) {
    const url = normalizeLabel(raw);
    if (!url) {
      return allowEmpty
        ? { ok: true, url: '' }
        : { ok: false, message: 'URL is required.' };
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, message: 'URL must start with http:// or https://.' };
      }
      return { ok: true, url };
    } catch {
      return { ok: false, message: 'Enter a valid URL (e.g. https://api.example.com).' };
    }
  }

  function validateDeployTargetId(raw) {
    const id = normalizeLabel(raw);
    if (!id) return { ok: true, deployTargetId: '' };
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(id)) {
      return {
        ok: false,
        message: 'Use letters, numbers, and . _ : - (max 64).'
      };
    }
    return { ok: true, deployTargetId: id };
  }

  /**
   * Create a domain (via shell `actions.createDomain`) and host it on a service.
   * @param {string} rawName
   * @param {{ serviceId?: string|null, clearInput?: Element|null, errorEl?: Element|null }} [options]
   */
  function createDomainOnHost(rawName, options = {}) {
    const createDomain = actions.createDomain;
    if (typeof createDomain !== 'function') return null;
    const input = options.clearInput || null;
    const errorEl = options.errorEl || null;
    const checked = validateDomainName(rawName);
    if (!checked.ok) {
      setFieldError(input, errorEl, checked.message);
      input?.focus?.();
      return null;
    }
    const preferredId = options.serviceId || null;
    let created = null;
    withPersist(() => {
      created = createDomain(checked.name);
      if (!created?.id) return;
      const host = (preferredId
        && architecture().services.find((service) => service.id === preferredId))
        || hostServiceForNewDomain();
      if (host) {
        state.architecture = assignDomainToService(architecture(), created.id, host.id);
        state.selectedArchitectureServiceId = host.id;
      }
    });
    if (!created?.id) {
      setFieldError(input, errorEl, `Domain “${checked.name}” already exists.`);
      return null;
    }
    if (input) input.value = '';
    clearFieldError(input, errorEl);
    revealArchitecturePanel('selected');
    renderArchitecture();
    return created;
  }

  function persistSelectedServicePatch(patch) {
    const selected = architecture().services.find(
      (service) => service.id === state.selectedArchitectureServiceId
    );
    if (!selected) return null;
    withPersist(() => {
      Object.assign(selected, patch);
    });
    return selected;
  }

  function renderPalette() {
    if (!dom.architectureDomainPalette) return;
    dom.architectureDomainPalette.innerHTML = '';
    const domains = state.domains || [];
    const selected = selectedService();
    if (dom.architectureDomainsHint) {
      dom.architectureDomainsHint.textContent = selected
        ? `Target: ${selected.name} · Move or drag onto a card`
        : 'Select a service to enable Move · or drag onto a card';
    }
    if (!domains.length) {
      const empty = document.createElement('li');
      empty.className = 'architecture-rail-empty';
      empty.innerHTML = '<p class="architecture-rail-empty-title">No domains</p><p class="hint">Open Service → + Domain, or Domain Designer.</p>';
      dom.architectureDomainPalette.appendChild(empty);
      return;
    }
    domains.forEach((domain) => {
      const host = hostServiceForDomain(domain.id);
      const elsewhere = selected && host && host.id !== selected.id;
      const onSelected = selected && host && host.id === selected.id;
      const item = document.createElement('li');
      item.className = [
        'architecture-rail-row',
        'architecture-palette-item',
        elsewhere ? 'is-elsewhere' : '',
        onSelected ? 'is-on-selected' : ''
      ].filter(Boolean).join(' ');
      item.draggable = true;
      item.dataset.domainId = domain.id;

      const main = document.createElement('div');
      main.className = 'architecture-rail-row-main';
      const title = document.createElement('span');
      title.className = 'architecture-rail-row-title';
      title.textContent = domain.name;
      const meta = document.createElement('span');
      meta.className = 'architecture-rail-row-meta';
      meta.textContent = host ? `on ${host.name}` : 'unassigned';
      main.appendChild(title);
      main.appendChild(meta);

      const action = document.createElement('button');
      action.type = 'button';
      action.className = elsewhere ? 'jx-btn jx-btn-primary architecture-rail-row-action' : 'jx-btn architecture-rail-row-action';
      if (elsewhere) {
        action.textContent = 'Move';
        action.title = `Move “${domain.name}” onto “${selected.name}”`;
        action.addEventListener('click', (event) => {
          event.stopPropagation?.();
          withPersist(() => {
            state.architecture = assignDomainToService(architecture(), domain.id, selected.id);
          });
          revealArchitecturePanel('selected');
          renderArchitecture();
        });
      } else if (onSelected) {
        action.textContent = 'Here';
        action.disabled = true;
        action.title = `Already on “${selected.name}”`;
      } else {
        action.textContent = 'Drag';
        action.disabled = true;
        action.title = 'Drag this row onto a service card';
      }

      item.title = elsewhere
        ? `Move “${domain.name}” onto “${selected.name}”, or drag onto a card`
        : `Drag “${domain.name}” onto another service card`;
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', domain.id);
        event.dataTransfer.effectAllowed = 'move';
      });
      // Whole-row click still moves when elsewhere (keyboard / large hit target).
      item.addEventListener('click', (event) => {
        if (!elsewhere || event.target === action || action.contains?.(event.target)) return;
        action.click();
      });

      item.appendChild(main);
      item.appendChild(action);
      dom.architectureDomainPalette.appendChild(item);
    });
  }

  function focusIssueTarget(issue) {
    const entityId = issue?.entityId;
    if (!entityId) {
      revealArchitecturePanel('validate');
      return;
    }
    const domain = domainById(entityId);
    if (domain) {
      const host = hostServiceForDomain(domain.id);
      if (host) {
        state.selectedArchitectureServiceId = host.id;
        revealArchitecturePanel('selected');
        renderArchitecture();
        return;
      }
      revealArchitecturePanel('domains');
      renderArchitecture();
      return;
    }
    const service = architecture().services.find((entry) => entry.id === entityId);
    if (service) {
      state.selectedArchitectureServiceId = service.id;
      revealArchitecturePanel('selected');
      renderArchitecture();
    }
  }

  function renderIssues() {
    if (!dom.architectureIssueList) return;
    dom.architectureIssueList.innerHTML = '';
    const severityRank = { error: 0, warn: 1, info: 2 };
    const issues = collectArchitectureIssues(state)
      .slice()
      .sort((left, right) => (severityRank[left.severity] ?? 9) - (severityRank[right.severity] ?? 9));
    if (dom.architectureValidateHint) {
      const errors = issues.filter((issue) => issue.severity === 'error').length;
      const warns = issues.filter((issue) => issue.severity === 'warn').length;
      dom.architectureValidateHint.textContent = issues.length
        ? `${errors} error${errors === 1 ? '' : 's'} · ${warns} warning${warns === 1 ? '' : 's'} · click to jump`
        : 'Clean — no architecture issues';
    }
    if (!issues.length) {
      const empty = document.createElement('li');
      empty.className = 'architecture-rail-empty architecture-issue architecture-issue-ok';
      empty.innerHTML = '<p class="architecture-rail-empty-title">All clear</p><p class="hint">Core, Users, and domain hosts look good.</p>';
      dom.architectureIssueList.appendChild(empty);
      return;
    }
    issues.forEach((issue) => {
      const item = document.createElement('li');
      item.className = `architecture-rail-row architecture-issue architecture-issue-${issue.severity}`;
      const main = document.createElement('div');
      main.className = 'architecture-rail-row-main';
      const badge = document.createElement('span');
      badge.className = `architecture-issue-badge architecture-issue-badge-${issue.severity}`;
      badge.textContent = issue.severity;
      const title = document.createElement('span');
      title.className = 'architecture-rail-row-title';
      title.textContent = issue.message;
      main.appendChild(badge);
      main.appendChild(title);

      if (issue.entityId) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'jx-btn architecture-rail-row-action architecture-issue-jump';
        button.textContent = 'Jump';
        button.title = 'Jump to related service or domain';
        button.addEventListener('click', () => focusIssueTarget(issue));
        item.appendChild(main);
        item.appendChild(button);
      } else {
        item.appendChild(main);
      }
      dom.architectureIssueList.appendChild(item);
    });
  }

  function removeLink(linkId) {
    withPersist(() => {
      const current = architecture();
      state.architecture = {
        ...current,
        links: current.links.filter((entry) => entry.id !== linkId)
      };
    });
    renderArchitecture();
  }

  function renderServiceDomainList(selected) {
    if (!dom.architectureServiceDomains) return;
    dom.architectureServiceDomains.innerHTML = '';
    if (!selected.domains.length) {
      const empty = document.createElement('li');
      empty.className = 'architecture-rail-empty architecture-service-domain-empty';
      empty.innerHTML = '<p class="architecture-rail-empty-title">No domains here</p><p class="hint">+ Domain below, or Pull from Domains.</p>';
      dom.architectureServiceDomains.appendChild(empty);
      return;
    }
    selected.domains.forEach((domainId) => {
      const domain = domainById(domainId);
      const item = document.createElement('li');
      item.className = 'architecture-rail-row architecture-service-domain-row';
      const main = document.createElement('div');
      main.className = 'architecture-rail-row-main';
      const title = document.createElement('span');
      title.className = 'architecture-rail-row-title';
      title.textContent = domain?.name || domainId;
      main.appendChild(title);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'jx-btn architecture-rail-row-action';
      remove.textContent = 'To Core';
      remove.setAttribute('aria-label', `Move domain ${domain?.name || domainId} to Core`);
      remove.title = 'Moves this domain back onto the Core service';
      remove.disabled = selected.kind === 'core';
      remove.hidden = selected.kind === 'core';
      remove.addEventListener('click', () => moveDomainToCore(domainId));
      item.appendChild(main);
      item.appendChild(remove);
      dom.architectureServiceDomains.appendChild(item);
    });
  }

  function renderInspector() {
    const selected = selectedService();
    const hasSelection = Boolean(selected);
    if (dom.architectureInspectEmpty) dom.architectureInspectEmpty.hidden = hasSelection;
    if (dom.architectureInspectBody) dom.architectureInspectBody.hidden = !hasSelection;

    if (!selected) {
      if (dom.architectureInspectHint) {
        dom.architectureInspectHint.textContent = 'Select a service on the canvas';
      }
      if (dom.architectureMoveDomainHint) dom.architectureMoveDomainHint.hidden = true;
      if (dom.architectureOpenDomainsBtn) dom.architectureOpenDomainsBtn.hidden = true;
      if (dom.architectureDeleteServiceBtn) {
        dom.architectureDeleteServiceBtn.disabled = true;
        dom.architectureDeleteServiceBtn.hidden = true;
      }
      renderServiceList(null);
      renderLinkList();
      return;
    }

    if (dom.architectureInspectHint) {
      dom.architectureInspectHint.textContent = `${serviceRoleLabel(selected)} · ${selected.domains.length} domain${selected.domains.length === 1 ? '' : 's'}`;
    }
    if (dom.architectureInspectKindBadge) {
      dom.architectureInspectKindBadge.textContent = serviceRoleLabel(selected);
      dom.architectureInspectKindBadge.dataset.kind = selected.kind;
    }
    const movable = domainsOnOtherServices(selected.id);
    if (dom.architectureOpenDomainsBtn) {
      dom.architectureOpenDomainsBtn.hidden = movable.length === 0;
      dom.architectureOpenDomainsBtn.textContent = movable.length
        ? `Pull ${movable.length} from Domains`
        : 'Pull from Domains';
    }
    if (dom.architectureMoveDomainHint) {
      dom.architectureMoveDomainHint.hidden = movable.length === 0;
      if (movable.length) {
        dom.architectureMoveDomainHint.textContent = `${movable.length} domain${movable.length === 1 ? '' : 's'} live elsewhere — Pull from Domains or drag onto this card.`;
      }
    }
    if (dom.architectureDeleteServiceBtn) {
      const isCore = selected.kind === 'core';
      dom.architectureDeleteServiceBtn.hidden = isCore;
      dom.architectureDeleteServiceBtn.disabled = isCore;
      dom.architectureDeleteServiceBtn.title = isCore
        ? 'Core cannot be deleted'
        : 'Delete this service; its domains return to Core';
    }

    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (dom.architectureInspectName && active !== dom.architectureInspectName) {
      dom.architectureInspectName.value = selected.name;
    }
    if (dom.architectureInspectUrl && active !== dom.architectureInspectUrl) {
      dom.architectureInspectUrl.value = selected.url;
    }
    if (dom.architectureInspectDeploy && active !== dom.architectureInspectDeploy) {
      dom.architectureInspectDeploy.value = selected.deployTargetId || '';
    }

    renderServiceDomainList(selected);
    renderServiceList(selected);
    renderLinkList();
  }

  function renderServiceList(selected) {
    if (!dom.architectureServiceList) return;
    dom.architectureServiceList.innerHTML = '';
    const services = architecture().services;
    if (dom.architectureServicesHint) {
      dom.architectureServicesHint.textContent = `${services.length} service${services.length === 1 ? '' : 's'} · Core keeps Users`;
    }
    if (!services.length) {
      const empty = document.createElement('li');
      empty.className = 'architecture-rail-empty architecture-service-empty';
      empty.innerHTML = '<p class="architecture-rail-empty-title">No services</p><p class="hint">Load a domain model first.</p>';
      dom.architectureServiceList.appendChild(empty);
      return;
    }
    services.forEach((service) => {
      const item = document.createElement('li');
      item.className = [
        'architecture-rail-row',
        'architecture-service-row',
        selected && service.id === selected.id ? 'is-selected' : ''
      ].filter(Boolean).join(' ');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = selected && service.id === selected.id ? 'architecture-rail-row-hit active' : 'architecture-rail-row-hit';
      const main = document.createElement('span');
      main.className = 'architecture-rail-row-main';
      const title = document.createElement('span');
      title.className = 'architecture-rail-row-title';
      title.textContent = service.name;
      const meta = document.createElement('span');
      meta.className = 'architecture-rail-row-meta';
      const count = service.domains.length;
      meta.textContent = `${count} domain${count === 1 ? '' : 's'}`;
      main.appendChild(title);
      main.appendChild(meta);
      const badge = document.createElement('span');
      badge.className = `architecture-kind-badge architecture-kind-badge-inline${service.kind === 'core' ? ' is-core' : ''}`;
      badge.textContent = serviceRoleLabel(service);
      button.appendChild(main);
      button.appendChild(badge);
      // Keep a flat textContent-compatible summary for tests / a11y name.
      button.setAttribute(
        'aria-label',
        `${service.name} · ${serviceRoleLabel(service)} · ${count} domain${count === 1 ? '' : 's'}`
      );
      button.dataset.summary = `${service.name} · ${serviceRoleLabel(service)} · ${count} domain${count === 1 ? '' : 's'}`;
      button.addEventListener('click', () => {
        state.selectedArchitectureServiceId = service.id;
        revealArchitecturePanel('selected');
        renderArchitecture();
      });
      item.appendChild(button);
      dom.architectureServiceList.appendChild(item);
    });
  }

  function renderLinkList() {
    if (!dom.architectureLinkList) return;
    dom.architectureLinkList.innerHTML = '';
    const links = architecture().links;
    if (dom.architectureLinksHint) {
      dom.architectureLinksHint.textContent = links.length
        ? `${links.length} connection${links.length === 1 ? '' : 's'} · Remove here`
        : 'Connect on the canvas · manage here';
    }
    if (dom.architectureLinksConnectBtn) {
      dom.architectureLinksConnectBtn.textContent = connectMode.active ? 'Connecting…' : 'Connect services';
      dom.architectureLinksConnectBtn.setAttribute('aria-pressed', connectMode.active ? 'true' : 'false');
      dom.architectureLinksConnectBtn.classList.toggle('is-active', connectMode.active);
    }
    if (!links.length) {
      const empty = document.createElement('li');
      empty.className = 'architecture-rail-empty architecture-link-empty';
      empty.innerHTML = '<p class="architecture-rail-empty-title">No links</p><p class="hint">Press Connect services, then source card → target.</p>';
      dom.architectureLinkList.appendChild(empty);
      return;
    }
    const services = architecture().services;
    links.forEach((link) => {
      const from = services.find((service) => service.id === link.from);
      const to = services.find((service) => service.id === link.to);
      const item = document.createElement('li');
      item.className = 'architecture-rail-row architecture-link-row';
      const main = document.createElement('div');
      main.className = 'architecture-rail-row-main';
      const title = document.createElement('span');
      title.className = 'architecture-rail-row-title';
      title.textContent = `${truncateLabel(from?.name || link.from)} → ${truncateLabel(to?.name || link.to)}`;
      const meta = document.createElement('span');
      meta.className = 'architecture-rail-row-meta';
      meta.textContent = architectureLinkLabel(link, services);
      const protocol = document.createElement('span');
      protocol.className = 'architecture-protocol-badge';
      protocol.textContent = link.protocol;
      main.appendChild(title);
      main.appendChild(meta);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'jx-btn architecture-rail-row-action';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove link ${architectureLinkLabel(link, services)}`);
      remove.addEventListener('click', () => removeLink(link.id));
      item.appendChild(main);
      item.appendChild(protocol);
      item.appendChild(remove);
      dom.architectureLinkList.appendChild(item);
    });
  }

  function renderCanvas() {
    if (!dom.architectureCanvas) return;
    const root = dom.architectureCanvas;
    root.innerHTML = '';
    const mini = dom.architectureMiniMap;
    if (mini) mini.innerHTML = '';
    const selectedId = state.selectedArchitectureServiceId;

    architecture().services.forEach((service) => {
      const box = document.createElement('article');
      const selected = service.id === selectedId;
      const connectFrom = connectMode.active && connectMode.fromId === service.id;
      box.className = [
        'architecture-service',
        `architecture-service-${service.kind}`,
        selected ? 'is-selected' : '',
        connectFrom ? 'is-connect-from' : '',
        connectMode.active ? 'is-connect-target' : ''
      ].filter(Boolean).join(' ');
      box.dataset.serviceId = service.id;
      box.style.left = `${service.x}px`;
      box.style.top = `${service.y}px`;
      box.style.width = `${service.width}px`;
      box.style.minHeight = `${service.height}px`;
      box.setAttribute('aria-label', `${service.name} service${selected ? ', selected' : ''}`);

      const header = document.createElement('header');
      header.textContent = `${service.name} · ${serviceRoleLabel(service)}`;
      header.title = 'Drag to move this service';
      box.appendChild(header);

      const badge = document.createElement('p');
      badge.className = 'architecture-url';
      badge.textContent = service.url;
      box.appendChild(badge);

      const chips = document.createElement('div');
      chips.className = 'architecture-domain-chips';
      if (!service.domains.length) {
        const empty = document.createElement('span');
        empty.className = 'architecture-domain-chip-empty';
        empty.textContent = 'Drop domains here';
        chips.appendChild(empty);
      }
      service.domains.forEach((domainId) => {
        const domain = domainById(domainId);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'architecture-domain-chip';
        chip.draggable = true;
        chip.dataset.domainId = domainId;
        chip.textContent = domain?.name || domainId;
        chip.title = `Drag to another service to move “${domain?.name || domainId}”`;
        chip.addEventListener('dragstart', (event) => {
          event.dataTransfer.setData('text/plain', domainId);
          event.dataTransfer.effectAllowed = 'move';
        });
        chips.appendChild(chip);
      });
      box.appendChild(chips);

      box.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        box.classList.add('is-drop-target');
      });
      box.addEventListener('dragleave', () => {
        box.classList.remove('is-drop-target');
      });
      box.addEventListener('drop', (event) => {
        event.preventDefault();
        box.classList.remove('is-drop-target');
        const domainId = event.dataTransfer.getData('text/plain');
        if (!domainId) return;
        withPersist(() => {
          state.architecture = assignDomainToService(architecture(), domainId, service.id);
        });
        state.selectedArchitectureServiceId = service.id;
        renderArchitecture();
      });

      header.addEventListener('pointerdown', (event) => {
        if (connectMode.active) return;
        // Some synthetic events omit `button`; treat missing as primary click.
        if (event.button != null && event.button !== 0) return;
        const startX = event.clientX;
        const startY = event.clientY;
        const originX = service.x;
        const originY = service.y;
        const move = (moveEvent) => {
          service.x = originX + (moveEvent.clientX - startX);
          service.y = originY + (moveEvent.clientY - startY);
          box.style.left = `${service.x}px`;
          box.style.top = `${service.y}px`;
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          saveState();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });

      box.addEventListener('click', (event) => {
        event.stopPropagation?.();
        if (handleServiceConnectClick(service.id)) return;
        state.selectedArchitectureServiceId = service.id;
        revealArchitecturePanel('selected');
        renderInspector();
        renderCanvas();
        syncScopePath();
      });

      root.appendChild(box);
      if (mini) {
        const mark = document.createElement('span');
        mark.className = `architecture-mini-mark${selected ? ' is-selected' : ''}`;
        mark.style.left = `${Math.max(4, service.x / 12)}px`;
        mark.style.top = `${Math.max(4, service.y / 12)}px`;
        mini.appendChild(mark);
      }
    });

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('architecture-links');
    architecture().links.forEach((link) => {
      const from = architecture().services.find((service) => service.id === link.from);
      const to = architecture().services.find((service) => service.id === link.to);
      if (!from || !to) return;
      const geometry = architectureLinkGeometry(from, to);
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.classList.add('architecture-link');
      group.dataset.linkId = link.id;
      group.dataset.protocol = link.protocol;
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hit.setAttribute('x1', String(geometry.x1));
      hit.setAttribute('y1', String(geometry.y1));
      hit.setAttribute('x2', String(geometry.x2));
      hit.setAttribute('y2', String(geometry.y2));
      hit.setAttribute('stroke', 'transparent');
      hit.setAttribute('stroke-width', '12');
      hit.classList.add('architecture-link-hit');
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(geometry.x1));
      line.setAttribute('y1', String(geometry.y1));
      line.setAttribute('x2', String(geometry.x2));
      line.setAttribute('y2', String(geometry.y2));
      line.setAttribute('stroke', 'currentColor');
      line.classList.add('architecture-link-line');
      const midX = (geometry.x1 + geometry.x2) / 2;
      const midY = (geometry.y1 + geometry.y2) / 2;
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(midX));
      label.setAttribute('y', String(midY - 6));
      label.setAttribute('text-anchor', 'middle');
      label.classList.add('architecture-link-label');
      label.textContent = link.protocol;
      hit.addEventListener('click', (event) => {
        event.stopPropagation?.();
        if (window.confirm(`Remove connection ${architectureLinkLabel(link, architecture().services)}?`)) {
          removeLink(link.id);
        }
      });
      group.appendChild(hit);
      group.appendChild(line);
      group.appendChild(label);
      svg.appendChild(group);
    });
    root.appendChild(svg);
    syncConnectChrome();
  }

  function renderEmptyState() {
    if (ownEmptyState || !dom.architectureEmptyState) return;
    const empty = !(state.domains || []).length;
    dom.architectureEmptyState.hidden = !empty;
  }

  function renderCoach() {
    if (ownCoach || !dom.architectureCoach) return;
    const hasDomains = (state.domains || []).length > 0;
    const onlyCore = architecture().services.length <= 1;
    const noLinks = architecture().links.length === 0;
    const show = hasDomains && onlyCore && noLinks && !coachDismissed;
    dom.architectureCoach.hidden = !show;
  }

  /** Snapshot for Tab-owned ArchitectureCoach / EmptyState Components. */
  function chromeSnapshot() {
    const arch = architecture();
    return {
      empty: !(state.domains || []).length,
      hasDomains: (state.domains || []).length > 0,
      onlyCore: arch.services.length <= 1,
      noLinks: arch.links.length === 0
    };
  }

  function renderArchitecture() {
    architecture();
    renderEmptyState();
    renderCoach();
    renderPalette();
    renderCanvas();
    renderInspector();
    renderIssues();
    syncConnectChrome();
    syncScopePath();
    syncPanelBadges();
    syncProtocolSelects(null);
  }

  function wire() {
    const architectureTabs = typeof document.querySelectorAll === 'function'
      ? document.querySelectorAll('[data-architecture-tab]')
      : [];
    architectureTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const key = tab.getAttribute('data-architecture-tab');
        if (key) revealArchitecturePanel(key);
      });
    });
    if (dom.architectureToggleSidebarBtn) {
      dom.architectureToggleSidebarBtn.addEventListener('click', () => {
        const open = !dom.architectureSidebar?.classList.contains('open');
        setArchitectureSidebarOpen(open, { persist: true });
        if (open) revealArchitecturePanel(activePanel);
      });
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      let resizeTimer = 0;
      window.addEventListener('resize', () => {
        if (resizeTimer) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          resizeTimer = 0;
          syncRailToViewport();
        }, 120);
      });
    }
    if (!ownCoach && dom.architectureCoachDismissBtn) {
      dom.architectureCoachDismissBtn.addEventListener('click', () => {
        coachDismissed = true;
        try {
          localStorage.setItem(COACH_DISMISS_KEY, '1');
        } catch {
          /* ignore quota */
        }
        renderCoach();
      });
    }
    const addSplitOutService = () => {
      const input = dom.architectureServiceNameInput;
      const errorEl = dom.architectureServiceNameError;
      const raw = String(input?.value || '').trim();
      // Blank → default name "Service" (tests + quick create); still validate uniqueness.
      const checked = validateServiceName(raw || 'Service');
      if (!checked.ok) {
        setFieldError(input, errorEl, checked.message);
        input?.focus?.();
        return;
      }
      withPersist(() => {
        state.architecture = addArchitectureService(architecture(), {
          name: checked.name,
          kind: 'domain',
          url: 'http://localhost:3001/api/1.0.0'
        }, state.domains);
      });
      if (input) input.value = '';
      clearFieldError(input, errorEl);
      const created = architecture().services[architecture().services.length - 1];
      if (created) state.selectedArchitectureServiceId = created.id;
      revealArchitecturePanel('selected');
      renderArchitecture();
    };
    if (dom.architectureAddServiceBtn) {
      dom.architectureAddServiceBtn.addEventListener('click', addSplitOutService);
    }
    if (dom.architectureServiceNameInput) {
      dom.architectureServiceNameInput.addEventListener('input', () => {
        clearFieldError(dom.architectureServiceNameInput, dom.architectureServiceNameError);
      });
      dom.architectureServiceNameInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        addSplitOutService();
      });
    }
    if (dom.architectureAddDomainBtn) {
      dom.architectureAddDomainBtn.addEventListener('click', () => {
        createDomainOnHost(dom.architectureDomainNameInput?.value, {
          clearInput: dom.architectureDomainNameInput || null,
          errorEl: dom.architectureDomainNameError || null
        });
      });
    }
    if (dom.architectureDomainNameInput) {
      dom.architectureDomainNameInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        createDomainOnHost(dom.architectureDomainNameInput?.value, {
          clearInput: dom.architectureDomainNameInput || null,
          errorEl: dom.architectureDomainNameError || null
        });
      });
    }
    const addDomainOnSelected = () => {
      const serviceId = state.selectedArchitectureServiceId;
      if (!serviceId) {
        setFieldError(
          dom.architectureInspectDomainNameInput,
          dom.architectureInspectDomainNameError,
          'Select a service first.'
        );
        return;
      }
      createDomainOnHost(dom.architectureInspectDomainNameInput?.value, {
        serviceId,
        clearInput: dom.architectureInspectDomainNameInput || null,
        errorEl: dom.architectureInspectDomainNameError || null
      });
    };
    if (dom.architectureInspectAddDomainBtn) {
      dom.architectureInspectAddDomainBtn.addEventListener('click', addDomainOnSelected);
    }
    if (dom.architectureInspectDomainNameInput) {
      dom.architectureInspectDomainNameInput.addEventListener('input', () => {
        clearFieldError(
          dom.architectureInspectDomainNameInput,
          dom.architectureInspectDomainNameError
        );
      });
      dom.architectureInspectDomainNameInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        addDomainOnSelected();
      });
    }
    const wireValidatedAutosave = (input, errorEl, validate) => {
      if (!input) return;
      const commit = () => {
        const result = validate(input.value);
        if (!result.ok) {
          setFieldError(input, errorEl, result.message);
          return;
        }
        clearFieldError(input, errorEl);
        if (!result.patch || !persistSelectedServicePatch(result.patch)) return;
        renderArchitecture();
      };
      input.addEventListener('input', () => {
        if (input.classList.contains('is-invalid')) clearFieldError(input, errorEl);
      });
      input.addEventListener('change', commit);
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        input.blur?.();
        commit();
      });
    };
    wireValidatedAutosave(
      dom.architectureInspectName,
      dom.architectureInspectNameError,
      (value) => {
        const checked = validateServiceName(value, {
          ignoredId: state.selectedArchitectureServiceId,
          required: true
        });
        if (!checked.ok) return checked;
        return { ok: true, patch: { name: checked.name } };
      }
    );
    wireValidatedAutosave(
      dom.architectureInspectUrl,
      dom.architectureInspectUrlError,
      (value) => {
        const checked = validateServiceUrl(value, { allowEmpty: true });
        if (!checked.ok) return checked;
        // Empty keeps the previous URL (do not wipe).
        if (!checked.url) return { ok: true, patch: null };
        return { ok: true, patch: { url: checked.url } };
      }
    );
    wireValidatedAutosave(
      dom.architectureInspectDeploy,
      dom.architectureInspectDeployError,
      (value) => {
        const checked = validateDeployTargetId(value);
        if (!checked.ok) return checked;
        return { ok: true, patch: { deployTargetId: checked.deployTargetId } };
      }
    );

    if (dom.architectureDeleteServiceBtn) {
      dom.architectureDeleteServiceBtn.addEventListener('click', () => {
        const id = state.selectedArchitectureServiceId;
        if (!id) return;
        const selected = architecture().services.find((service) => service.id === id);
        if (selected?.kind === 'core') return;
        if (!window.confirm(`Delete service “${selected?.name || id}”? Its domains return to Core.`)) return;
        withPersist(() => {
          state.architecture = removeArchitectureService(architecture(), id, state.domains);
        });
        state.selectedArchitectureServiceId = null;
        renderArchitecture();
      });
    }
    if (dom.architectureOpenDomainsBtn) {
      dom.architectureOpenDomainsBtn.addEventListener('click', () => {
        revealArchitecturePanel('domains');
      });
    }
    const toggleConnect = () => {
      if (connectMode.active) stopConnectMode();
      else startConnectMode();
    };
    if (dom.architectureConnectBtn) {
      dom.architectureConnectBtn.addEventListener('click', toggleConnect);
    }
    if (dom.architectureLinksConnectBtn) {
      dom.architectureLinksConnectBtn.addEventListener('click', () => {
        setArchitectureSidebarOpen(false);
        toggleConnect();
      });
    }
    if (dom.architectureCancelConnectBtn) {
      dom.architectureCancelConnectBtn.addEventListener('click', () => stopConnectMode());
    }
    if (dom.architectureLinkProtocol) {
      dom.architectureLinkProtocol.addEventListener('change', () => {
        syncProtocolSelects(dom.architectureLinkProtocol);
        syncConnectChrome();
      });
    }
    if (dom.architectureLinkProtocolPanel) {
      dom.architectureLinkProtocolPanel.addEventListener('change', () => {
        if (dom.architectureLinkProtocol) {
          dom.architectureLinkProtocol.value = dom.architectureLinkProtocolPanel.value;
        }
        syncConnectChrome();
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && connectMode.active) {
          event.preventDefault();
          stopConnectMode();
        }
      });
    }
    if (dom.architectureExportImageBtn) {
      dom.architectureExportImageBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '16px sans-serif';
        ctx.fillText('Architecture inventory (list export — not a diagram screenshot)', 40, 28);
        architecture().services.forEach((service, index) => {
          ctx.fillText(
            `${service.name} (${service.kind}) — ${service.domains.map((id) => domainById(id)?.name || id).join(', ') || 'no domains'}`,
            40,
            60 + index * 28
          );
        });
        architecture().links.forEach((link, index) => {
          ctx.fillText(architectureLinkLabel(link, architecture().services), 40, 60 + (architecture().services.length + 1 + index) * 28);
        });
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'architecture-inventory.png';
        link.click();
      });
    }
  }

  wire();
  const preferOpen = readRailPreference();
  if (preferOpen && !isNarrowStage()) {
    revealArchitecturePanel('services');
    setArchitectureSidebarOpen(true, { persist: false });
  } else {
    setArchitectureSidebarOpen(false, { persist: false });
    // Keep panel content ready without forcing the rail open on narrow stages.
    activePanel = 'services';
  }

  return {
    renderArchitecture,
    revealArchitecturePanel,
    setArchitectureSidebarOpen,
    chromeSnapshot
  };
}
