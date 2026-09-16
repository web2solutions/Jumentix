/**
 * helpPopoverState — which process-help popover is open, kept outside the DOM
 * (JUM-770).
 *
 * The monitoring table re-renders on every WebSocket push (innerHTML reset),
 * which used to destroy an open popover within a second. The open key lives
 * here instead; after each render the row whose key matches gets its popover
 * re-opened, so the help text survives the refresh cycle.
 */
export function createHelpPopoverState() {
  let openKey = null;
  return {
    toggle(key) {
      openKey = openKey === key ? null : key;
      return openKey;
    },
    open(key) {
      openKey = key;
    },
    close() {
      openKey = null;
    },
    current() {
      return openKey;
    },
    isOpen(key) {
      return openKey !== null && openKey === key;
    }
  };
}

// The popover to re-apply after a re-render: the tracked key, but only while
// its row is still visible (a filter change can legitimately remove it).
export function resolveOpenHelpKey(currentKey, visibleKeys) {
  if (currentKey == null) return null;
  const keys = Array.isArray(visibleKeys) ? visibleKeys : [...(visibleKeys || [])];
  return keys.includes(currentKey) ? currentKey : null;
}
