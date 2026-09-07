/**
 * sidebarGroups — the Domain Designer sidebar, grouped into switchable panels
 * (JUM-729 follow-up).
 *
 * The sidebar held ten panels in one scrolling column: Domains, Bounded
 * Context, Entities, Relationship, Entity Inspector, Export, History, Legend,
 * Model Check, Schema Diff. Reaching the last of them meant scrolling past the
 * entity inspector, which is the tallest panel in the app, and nothing on
 * screen said those panels existed at all — the column simply ended below the
 * fold.
 *
 * The grouping is declared in the markup (`data-sidebar-group` on each panel),
 * not here, so a new panel joins a group by saying which one it belongs to.
 * Every panel keeps its id, its markup and its handlers: this module only
 * decides which group is on screen.
 *
 * Keyboard behaviour mirrors `tabs.js` — the WAI tabs pattern, with
 * `stopPropagation` so the global shortcut map does not also act on the arrow
 * keys while the group bar has focus.
 */

const GROUP_KEYS = ['model', 'inspector', 'quality', 'share'];

/**
 * @param {Object} options
 * @param {Document} options.documentRef - the document to query.
 * @param {Object} options.state - shared designer state (mutated in place).
 * @param {Function} options.saveState - persist after a group switch.
 */
export function createSidebarGroups({ documentRef, state, saveState }) {
  const buttons = GROUP_KEYS
    .map((key) => ({ key, button: documentRef.querySelector(`[data-sidebar-tab="${key}"]`) }))
    .filter((entry) => entry.button);
  const panels = Array.from(documentRef.querySelectorAll('[data-sidebar-group]'));
  const drawer = documentRef.getElementById('designer-sidebar');
  const drawerToggle = documentRef.getElementById('toggle-sidebar-btn');

  // Same reasoning as `chosenOpen`: which group is on screen is the user's
  // choice, and a view replacement must not silently move them.
  let chosenGroup = null;

  function activeGroup() {
    if (GROUP_KEYS.includes(chosenGroup)) return chosenGroup;
    const requested = state?.view?.sidebarGroup;
    return GROUP_KEYS.includes(requested) ? requested : 'model';
  }

  // The user's own choice, held outside `state.view`.
  //
  // `state.view` is replaced wholesale by the load and by every snapshot the
  // store applies, and a replacement that lands after the user opened the
  // drawer took the drawer with it — the panels closed on their own a moment
  // after being opened, with nothing on screen to explain it. The view still
  // carries the flag, so the choice survives a reload; this is what keeps it
  // from being undone inside one.
  let chosenOpen = null;

  function isOpen() {
    return chosenOpen === null ? Boolean(state?.view?.sidebarOpen) : chosenOpen;
  }

  function renderSidebarGroups() {
    const active = activeGroup();
    if (drawer) {
      drawer.classList.toggle('open', isOpen());
      // Hidden from assistive technology while closed: the panels are off
      // screen, and a tab stop into a drawer nobody can see is a trap.
      //
      // `visibility: hidden` in the stylesheet does the same for focus and for
      // hit-testing, and it is what the platform already understands.
      // `inert` was set here too and is not: it leaves a subtree that reads as
      // present-but-not-actionable, which browser automation reports as an
      // element it can see and cannot click — a failure mode with no symptom
      // in the DOM to point at.
      drawer.setAttribute('aria-hidden', String(!isOpen()));
    }
    if (drawerToggle) {
      drawerToggle.setAttribute('aria-expanded', String(isOpen()));
      drawerToggle.title = isOpen() ? 'Hide panels (P)' : 'Show panels (P)';
    }
    buttons.forEach((entry) => {
      const isActive = entry.key === active;
      entry.button.classList.toggle('active', isActive);
      entry.button.setAttribute('aria-selected', String(isActive));
      entry.button.tabIndex = isActive ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.sidebarGroup !== active;
    });
  }

  function setActiveGroup(key) {
    if (!GROUP_KEYS.includes(key)) return;
    chosenGroup = key;
    state.view.sidebarGroup = key;
    renderSidebarGroups();
    saveState();
  }

  function setDrawerOpen(open) {
    chosenOpen = Boolean(open);
    state.view.sidebarOpen = Boolean(open);
    renderSidebarGroups();
    saveState();
  }

  function toggleDrawer() {
    setDrawerOpen(!isOpen());
  }

  /**
   * Bring a panel's group forward.
   *
   * Selecting an entity on the canvas fills the Entity Inspector, which lives
   * in another group — without this the selection would appear to do nothing.
   */
  function revealGroupFor(panelId) {
    const panel = documentRef.getElementById(panelId);
    const group = panel?.closest('[data-sidebar-group]')?.dataset?.sidebarGroup;
    if (!group) return;
    // Selecting on the canvas is the request to inspect it, so the drawer
    // opens on the right group rather than filling a panel behind a closed
    // drawer and looking like the selection did nothing.
    chosenOpen = true;
    chosenGroup = group;
    state.view.sidebarGroup = group;
    state.view.sidebarOpen = true;
    renderSidebarGroups();
    saveState();
  }

  if (drawerToggle) drawerToggle.addEventListener('click', toggleDrawer);

  buttons.forEach((entry, index) => {
    entry.button.addEventListener('click', () => setActiveGroup(entry.key));
    entry.button.addEventListener('keydown', (event) => {
      let nextIndex = null;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = buttons.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      event.stopPropagation();
      const next = buttons[nextIndex];
      setActiveGroup(next.key);
      next.button.focus();
    });
  });

  return {
    renderSidebarGroups,
    setActiveGroup,
    setDrawerOpen,
    toggleDrawer,
    isOpen,
    revealGroupFor
  };
}
