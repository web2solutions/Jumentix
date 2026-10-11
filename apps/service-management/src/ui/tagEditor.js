/**
 * tagEditor — multi-value list control without comma-separated magic strings.
 *
 * Each value is a removable chip; new values are added through an explicit
 * Add action (Enter also works). Callers own persistence via `onChange`.
 */

/**
 * @param {Object} options
 * @param {HTMLElement} options.root - container with `[data-tag-list]` and
 *   `[data-tag-input]` / `[data-tag-add]`.
 * @param {string} [options.listSelector]
 * @param {string} [options.inputSelector]
 * @param {string} [options.addSelector]
 * @param {string} [options.emptyLabel]
 * @param {Function} [options.normalize] - `(raw: string) => string`
 * @param {Function} [options.onChange] - `() => void` after values change
 * @returns {{ getValues: Function, setValues: Function, setDisabled: Function, clear: Function }}
 */
export function createTagEditor({
  root,
  listSelector = '[data-tag-list]',
  inputSelector = '[data-tag-input]',
  addSelector = '[data-tag-add]',
  emptyLabel = 'None yet — add one below',
  normalize = (raw) => String(raw || '').trim(),
  onChange = null
} = {}) {
  if (!root) {
    return {
      getValues: () => [],
      setValues: () => {},
      setDisabled: () => {},
      clear: () => {}
    };
  }

  const list = root.querySelector(listSelector);
  const input = root.querySelector(inputSelector);
  const addBtn = root.querySelector(addSelector);
  let values = [];
  let disabled = false;
  let suppressChange = false;

  function emitChange() {
    if (suppressChange || typeof onChange !== 'function') return;
    onChange([...values]);
  }

  function render() {
    if (!list) return;
    list.innerHTML = '';
    if (values.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'tag-editor-empty';
      empty.textContent = emptyLabel;
      list.appendChild(empty);
      return;
    }
    values.forEach((value, index) => {
      const li = document.createElement('li');
      li.className = 'tag-chip';
      const label = document.createElement('span');
      label.className = 'tag-chip-label';
      label.textContent = value;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tag-chip-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${value}`);
      remove.disabled = disabled;
      remove.onclick = () => {
        values = values.filter((_, i) => i !== index);
        render();
        emitChange();
      };
      li.appendChild(label);
      li.appendChild(remove);
      list.appendChild(li);
    });
  }

  function addCurrent() {
    if (disabled || !input) return;
    const next = normalize(input.value);
    if (!next) return;
    if (!values.includes(next)) values = [...values, next];
    input.value = '';
    render();
    emitChange();
    input.focus();
  }

  if (addBtn) addBtn.onclick = addCurrent;
  if (input) {
    input.onkeydown = (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      addCurrent();
    };
  }

  render();

  return {
    getValues: () => [...values],
    setValues: (next, { silent = false } = {}) => {
      const listValues = Array.isArray(next) ? next : [];
      values = [...new Set(listValues.map((item) => normalize(item)).filter(Boolean))];
      suppressChange = silent;
      render();
      suppressChange = false;
    },
    setDisabled: (nextDisabled) => {
      disabled = Boolean(nextDisabled);
      if (input) input.disabled = disabled;
      if (addBtn) addBtn.disabled = disabled;
      render();
    },
    clear: ({ silent = false } = {}) => {
      values = [];
      if (input) input.value = '';
      suppressChange = silent;
      render();
      suppressChange = false;
      if (!silent) emitChange();
    }
  };
}
