/**
 * contextMenu — right-click management for every element on the canvas
 * (JUM-729 follow-up).
 *
 * The canvas could move things and little else: every act of management —
 * renaming, deleting, marking an aggregate root, changing a cardinality,
 * reordering a field — meant leaving the diagram, finding the element again in
 * a sidebar form, and editing it there. The JointJS data-modeling demo puts
 * those actions on the element itself, and this is the same idea: one menu per
 * element kind, opened where the pointer is.
 *
 * The module owns no model rules. It is handed a list of items — label,
 * whether it is destructive, and what to run — and it renders them, positions
 * the menu inside the viewport, and closes on Escape, on an outside click, or
 * after an item runs. What each item does belongs to the caller, which is
 * where the state and `withPersist` live.
 */

/**
 * @param {Object} options
 * @param {Document} options.documentRef - the document to render into.
 */
export function createContextMenu({ documentRef }) {
  let menuEl = null;

  function close() {
    if (!menuEl) return;
    menuEl.remove();
    menuEl = null;
  }

  function onDocumentPointerDown(event) {
    if (menuEl && menuEl.contains(event.target)) return;
    close();
  }

  function onDocumentKeyDown(event) {
    if (event.key !== 'Escape' || !menuEl) return;
    // The canvas also acts on Escape (it cancels an anchor drag); closing the
    // menu is the more specific answer while one is open.
    event.stopPropagation();
    close();
  }

  documentRef.addEventListener('pointerdown', onDocumentPointerDown, true);
  documentRef.addEventListener('keydown', onDocumentKeyDown, true);

  /**
   * @param {{ clientX: number, clientY: number }} at - where to open.
   * @param {string} title - what the menu acts on, shown as its heading.
   * @param {Array<{label: string, run?: Function, danger?: boolean, separator?: boolean, disabled?: boolean, checked?: boolean}>} items
   */
  function open(at, title, items) {
    close();
    menuEl = documentRef.createElement('div');
    menuEl.className = 'canvas-context-menu';
    menuEl.setAttribute('role', 'menu');
    menuEl.setAttribute('aria-label', title);

    const heading = documentRef.createElement('p');
    heading.className = 'canvas-context-menu-title';
    heading.textContent = title;
    menuEl.appendChild(heading);

    items.forEach((item) => {
      if (item.separator) {
        menuEl.appendChild(documentRef.createElement('hr'));
        return;
      }
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.className = `canvas-context-menu-item${item.danger ? ' danger' : ''}`;
      button.textContent = item.checked ? `✓ ${item.label}` : item.label;
      button.disabled = Boolean(item.disabled);
      button.addEventListener('click', () => {
        close();
        item.run();
      });
      menuEl.appendChild(button);
    });

    documentRef.body.appendChild(menuEl);

    // Opened at the pointer, then pulled back inside the viewport — a menu on
    // an element near the right or bottom edge would otherwise open partly
    // off screen, which is where the longest menus tend to be needed.
    const rect = menuEl.getBoundingClientRect();
    const view = documentRef.defaultView;
    const maxLeft = Math.max(4, (view?.innerWidth || rect.width) - rect.width - 8);
    const maxTop = Math.max(4, (view?.innerHeight || rect.height) - rect.height - 8);
    menuEl.style.left = `${Math.min(at.clientX, maxLeft)}px`;
    menuEl.style.top = `${Math.min(at.clientY, maxTop)}px`;

    const firstItem = menuEl.querySelector('.canvas-context-menu-item:not([disabled])');
    if (firstItem) firstItem.focus();
  }

  return { open, close };
}
