/**
 * tabs — backward-compatible factory over TabHost (class-component model).
 *
 * Prefer `ServiceManagementApp` + `TabApplication` subclasses for new work.
 * This factory remains for callers that still expect `{ renderTabs, setActiveTab }`.
 */

import { TabHost } from './TabHost.js';
import { LegacyTabApplication } from './LegacyTabApplication.js';

/**
 * @param {Object} options
 * @param {Object} options.dom
 * @param {Object} options.state
 * @param {Function} options.saveState
 * @param {Function} [options.beforeTabChange]
 * @param {Function} [options.afterTabChange]
 */
export function createTabs({ dom, state, saveState, beforeTabChange, afterTabChange }) {
  const host = new TabHost({
    state,
    saveState,
    beforeTabChange,
    afterTabChange
  });

  const defs = [
    { key: 'architecture', button: dom.tabArchitectureBtn, section: dom.tabArchitecture },
    { key: 'domain-designer', button: dom.tabDomainDesignerBtn, section: dom.tabDomainDesigner },
    { key: 'interface-designer', button: dom.tabInterfaceDesignerBtn, section: dom.tabInterfaceDesigner },
    { key: 'service-config', button: dom.tabServiceConfigBtn, section: dom.tabServiceConfig },
    { key: 'deploy-management', button: dom.tabDeployManagementBtn, section: dom.tabDeployManagement },
    { key: 'monitoring', button: dom.tabMonitoringBtn, section: dom.tabMonitoring },
    { key: 'openapi', button: dom.tabOpenapiBtn, section: dom.tabOpenapi },
    { key: 'code-workspace', button: dom.tabCodeWorkspaceBtn, section: dom.tabCodeWorkspace }
  ];

  const ctx = { state, dom, actions: {} };
  defs.forEach((def) => {
    host.register(new LegacyTabApplication({
      key: def.key,
      el: def.section || null,
      button: def.button || null,
      ctx
    }));
  });

  host.mount();

  return {
    renderTabs: () => host.renderTabs(),
    setActiveTab: (tab) => host.setActiveTab(tab),
    applyHashTab: (options) => host.applyHashTab(options),
    tabKeyFromHash: () => host.tabKeyFromHash(),
    /** @deprecated access for tests / migration */
    _host: host
  };
}
