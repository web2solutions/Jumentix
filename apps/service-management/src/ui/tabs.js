/**
 * tabs — tab switching of the Service Management designer, extracted from
 * `script.js` by JUM-469.
 *
 * This module is inherently DOM-bound (it toggles `active` classes on the
 * tab buttons and sections); the explicit interface is the injected
 * `document` handle plus the shared `state`. Behaviour is verbatim from the
 * monolith: same tab map, same class toggles, same persist-on-switch.
 *
 * JUM-488 added the WAI-ARIA tablist layer on top of that behaviour:
 * `aria-selected` + roving `tabindex` mirror the active class, and the
 * ArrowLeft/ArrowRight/Home/End keys move focus between tabs with automatic
 * activation (the WAI tabs pattern). Mouse and programmatic switching are
 * unchanged.
 */

/**
 * @param {Object} options
 * @param {Object} options.dom - resolved element map from `script.js`.
 * @param {Object} options.state - shared designer state (mutated in place).
 * @param {Function} options.saveState - persist after a tab switch.
 */
export function createTabs({ dom, state, saveState }) {
  const tabMap = [
    {
      key: 'domain-designer',
      button: dom.tabDomainDesignerBtn,
      section: dom.tabDomainDesigner
    },
    {
      key: 'interface-designer',
      button: dom.tabInterfaceDesignerBtn,
      section: dom.tabInterfaceDesigner
    },
    {
      key: 'service-config',
      button: dom.tabServiceConfigBtn,
      section: dom.tabServiceConfig
    },
    {
      key: 'deploy-management',
      button: dom.tabDeployManagementBtn,
      section: dom.tabDeployManagement
    },
    {
      key: 'monitoring',
      button: dom.tabMonitoringBtn,
      section: dom.tabMonitoring
    },
    {
      key: 'code-workspace',
      button: dom.tabCodeWorkspaceBtn,
      section: dom.tabCodeWorkspace
    }
  ];

  function renderTabs() {
    const activeTab = state.activeTab || 'domain-designer';

    tabMap.forEach((tab) => {
      const isActive = tab.key === activeTab;
      if (tab.button) {
        tab.button.classList.toggle('active', isActive);
        tab.button.setAttribute('aria-selected', String(isActive));
        tab.button.tabIndex = isActive ? 0 : -1;
      }
      if (tab.section) tab.section.classList.toggle('active', isActive);
    });
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    renderTabs();
    saveState();
  }

  /**
   * WAI-ARIA tabs keyboard pattern: horizontal arrow keys cycle the tab bar
   * (wrapping), Home/End jump to the first/last tab, and the focused tab
   * activates automatically. `stopPropagation` keeps the global shortcut map
   * in `script.js` (arrow-key entity nudging, Space pan) from firing while
   * the tab bar has focus.
   */
  function wireTabKeyboard() {
    const wired = tabMap.filter((tab) => tab.button);
    wired.forEach((tab, index) => {
      tab.button.addEventListener('keydown', (event) => {
        let nextIndex = null;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % wired.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + wired.length) % wired.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = wired.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        event.stopPropagation();
        const next = wired[nextIndex];
        setActiveTab(next.key);
        next.button.focus();
      });
    });
  }

  wireTabKeyboard();

  return {
    renderTabs,
    setActiveTab
  };
}
