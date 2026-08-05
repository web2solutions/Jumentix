/**
 * tabs — tab switching of the Service Management designer, extracted from
 * `script.js` by JUM-469.
 *
 * This module is inherently DOM-bound (it toggles `active` classes on the
 * tab buttons and sections); the explicit interface is the injected
 * `document` handle plus the shared `state`. Behaviour is verbatim from the
 * monolith: same tab map, same class toggles, same persist-on-switch.
 */

/**
 * @param {Object} options
 * @param {Object} options.dom - resolved element map from `script.js`.
 * @param {Object} options.state - shared designer state (mutated in place).
 * @param {Function} options.saveState - persist after a tab switch.
 */
export function createTabs({ dom, state, saveState }) {
  function renderTabs() {
    const activeTab = state.activeTab || 'domain-designer';
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
      }
    ];

    tabMap.forEach((tab) => {
      if (tab.button) tab.button.classList.toggle('active', tab.key === activeTab);
      if (tab.section) tab.section.classList.toggle('active', tab.key === activeTab);
    });
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    renderTabs();
    saveState();
  }

  return {
    renderTabs,
    setActiveTab
  };
}
