/**
 * architectureCanvas — Architecture tab (JUM-816).
 * DnD domain chips onto service boxes, links, inspector, validation badges.
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

function fillSelect(select, items, selected) {
  if (!select) return;
  select.innerHTML = '';
  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name || item.id;
    if (item.id === selected) option.selected = true;
    select.appendChild(option);
  });
}

export function createArchitectureCanvas({ dom, state, actions }) {
  const { withPersist, saveState } = actions;

  function architecture() {
    state.architecture = normalizeArchitectureInput(state.architecture, state.domains);
    return state.architecture;
  }

  function domainById(id) {
    return (state.domains || []).find((domain) => domain.id === id);
  }

  function renderPalette() {
    if (!dom.architectureDomainPalette) return;
    const assigned = new Set(architecture().services.flatMap((service) => service.domains));
    dom.architectureDomainPalette.innerHTML = '';
    (state.domains || []).forEach((domain) => {
      const item = document.createElement('li');
      item.className = 'architecture-palette-item';
      item.draggable = true;
      item.dataset.domainId = domain.id;
      item.textContent = `${domain.name}${assigned.has(domain.id) ? '' : ' (unassigned)'}`;
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', domain.id);
        event.dataTransfer.effectAllowed = 'move';
      });
      dom.architectureDomainPalette.appendChild(item);
    });
  }

  function renderIssues() {
    if (!dom.architectureIssueList) return;
    dom.architectureIssueList.innerHTML = '';
    collectArchitectureIssues(state).forEach((issue) => {
      const item = document.createElement('li');
      item.className = `architecture-issue architecture-issue-${issue.severity}`;
      item.textContent = `${issue.severity}: ${issue.message}`;
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

  function renderInspector() {
    const selected = architecture().services.find((service) => service.id === state.selectedArchitectureServiceId)
      || architecture().services[0];
    if (!selected) return;
    state.selectedArchitectureServiceId = selected.id;
    if (dom.architectureInspectName) dom.architectureInspectName.value = selected.name;
    if (dom.architectureInspectKind) dom.architectureInspectKind.value = selected.kind;
    if (dom.architectureInspectUrl) dom.architectureInspectUrl.value = selected.url;
    if (dom.architectureInspectDeploy) dom.architectureInspectDeploy.value = selected.deployTargetId || '';
    fillSelect(dom.architectureInspectDomain, state.domains || [], (state.domains || [])[0]?.id);
    fillSelect(dom.architectureLinkFrom, architecture().services, selected.id);
    fillSelect(dom.architectureLinkTo, architecture().services, architecture().services[1]?.id || selected.id);
    if (dom.architectureServiceList) {
      dom.architectureServiceList.innerHTML = '';
      architecture().services.forEach((service) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${service.name} (${service.kind})`;
        button.className = service.id === selected.id ? 'active' : '';
        button.addEventListener('click', () => {
          state.selectedArchitectureServiceId = service.id;
          renderArchitecture();
        });
        item.appendChild(button);
        dom.architectureServiceList.appendChild(item);
      });
    }
    if (dom.architectureLinkList) {
      dom.architectureLinkList.innerHTML = '';
      architecture().links.forEach((link) => {
        const item = document.createElement('li');
        item.textContent = `${link.from} —${link.protocol}→ ${link.to}`;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', `Remove link ${link.id}`);
        remove.addEventListener('click', () => removeLink(link.id));
        item.appendChild(remove);
        dom.architectureLinkList.appendChild(item);
      });
    }
  }

  function renderCanvas() {
    if (!dom.architectureCanvas) return;
    const root = dom.architectureCanvas;
    root.innerHTML = '';
    const mini = dom.architectureMiniMap;
    if (mini) mini.innerHTML = '';
    architecture().services.forEach((service) => {
      const box = document.createElement('article');
      box.className = `architecture-service architecture-service-${service.kind}`;
      box.dataset.serviceId = service.id;
      box.style.left = `${service.x}px`;
      box.style.top = `${service.y}px`;
      box.style.width = `${service.width}px`;
      box.style.minHeight = `${service.height}px`;
      const header = document.createElement('header');
      header.textContent = `${service.name} · ${service.kind}`;
      box.appendChild(header);
      const badge = document.createElement('p');
      badge.className = 'architecture-url';
      badge.textContent = service.url;
      box.appendChild(badge);
      const chips = document.createElement('div');
      chips.className = 'architecture-domain-chips';
      service.domains.forEach((domainId) => {
        const domain = domainById(domainId);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'architecture-domain-chip';
        chip.draggable = true;
        chip.dataset.domainId = domainId;
        chip.textContent = domain?.name || domainId;
        chip.addEventListener('dragstart', (event) => {
          event.dataTransfer.setData('text/plain', domainId);
        });
        chips.appendChild(chip);
      });
      box.appendChild(chips);
      box.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      });
      box.addEventListener('drop', (event) => {
        event.preventDefault();
        const domainId = event.dataTransfer.getData('text/plain');
        if (!domainId) return;
        withPersist(() => {
          state.architecture = assignDomainToService(architecture(), domainId, service.id);
        });
        renderArchitecture();
      });
      header.addEventListener('pointerdown', (event) => {
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
      box.addEventListener('click', () => {
        state.selectedArchitectureServiceId = service.id;
        renderInspector();
      });
      root.appendChild(box);
      if (mini) {
        const mark = document.createElement('span');
        mark.className = 'architecture-mini-mark';
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
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(from.x + from.width / 2));
      line.setAttribute('y1', String(from.y + 20));
      line.setAttribute('x2', String(to.x + to.width / 2));
      line.setAttribute('y2', String(to.y + 20));
      line.setAttribute('stroke', 'currentColor');
      line.dataset.protocol = link.protocol;
      svg.appendChild(line);
    });
    root.appendChild(svg);
  }

  function renderEmptyState() {
    if (!dom.architectureEmptyState) return;
    const empty = !(state.domains || []).length;
    dom.architectureEmptyState.hidden = !empty;
  }

  function renderArchitecture() {
    architecture();
    renderEmptyState();
    renderPalette();
    renderCanvas();
    renderInspector();
    renderIssues();
  }

  function wire() {
    if (dom.architectureAddServiceBtn) {
      dom.architectureAddServiceBtn.addEventListener('click', () => {
        const name = String(dom.architectureServiceNameInput?.value || '').trim() || 'Service';
        withPersist(() => {
          state.architecture = addArchitectureService(architecture(), {
            name,
            kind: 'domain',
            url: 'http://localhost:3001/api/1.0.0'
          }, state.domains);
        });
        if (dom.architectureServiceNameInput) dom.architectureServiceNameInput.value = '';
        renderArchitecture();
      });
    }
    if (dom.architectureSaveServiceBtn) {
      dom.architectureSaveServiceBtn.addEventListener('click', () => {
        const selected = architecture().services.find((service) => service.id === state.selectedArchitectureServiceId);
        if (!selected) return;
        withPersist(() => {
          selected.name = String(dom.architectureInspectName?.value || selected.name);
          selected.kind = dom.architectureInspectKind?.value === 'core' ? 'core' : 'domain';
          selected.url = String(dom.architectureInspectUrl?.value || selected.url);
          selected.deployTargetId = String(dom.architectureInspectDeploy?.value || '');
        });
        renderArchitecture();
      });
    }
    if (dom.architectureDeleteServiceBtn) {
      dom.architectureDeleteServiceBtn.addEventListener('click', () => {
        const id = state.selectedArchitectureServiceId;
        if (!id) return;
        withPersist(() => {
          state.architecture = removeArchitectureService(architecture(), id, state.domains);
        });
        renderArchitecture();
      });
    }
    if (dom.architectureMoveDomainBtn) {
      dom.architectureMoveDomainBtn.addEventListener('click', () => {
        const domainId = dom.architectureInspectDomain?.value;
        const serviceId = state.selectedArchitectureServiceId;
        if (!domainId || !serviceId) return;
        withPersist(() => {
          state.architecture = assignDomainToService(architecture(), domainId, serviceId);
        });
        renderArchitecture();
      });
    }
    if (dom.architectureAddLinkBtn) {
      dom.architectureAddLinkBtn.addEventListener('click', () => {
        const protocol = ARCHITECTURE_LINK_PROTOCOLS.includes(dom.architectureLinkProtocol?.value)
          ? dom.architectureLinkProtocol.value
          : 'rest';
        withPersist(() => {
          state.architecture = addArchitectureLink(architecture(), {
            from: dom.architectureLinkFrom?.value,
            to: dom.architectureLinkTo?.value,
            protocol
          }, state.domains);
        });
        renderArchitecture();
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
        architecture().services.forEach((service, index) => {
          ctx.fillText(`${service.name} (${service.kind})`, 40, 40 + index * 28);
        });
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'architecture.png';
        link.click();
      });
    }
  }

  wire();

  return {
    renderArchitecture
  };
}
