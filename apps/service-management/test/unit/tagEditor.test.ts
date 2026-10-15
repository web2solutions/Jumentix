/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/* eslint-disable @typescript-eslint/no-explicit-any, jest/prefer-to-have-length */
/**
 * Contract test for tagEditor without jsdom. Asserts the value API; chip DOM
 * rendering is covered indirectly by Domain Designer smoke markup + manual UI.
 */

import { createTagEditor } from '../../src/ui/tagEditor.js';

function el(tag: string, attrs: Record<string, string> = {}): any {
  const classNames = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
  const node: any = {
    tagName: tag.toUpperCase(),
    children: [] as any[],
    attributes: { ...attrs },
    textContent: '',
    value: '',
    disabled: false,
    onclick: null as null | (() => void),
    onkeydown: null as null | ((event: any) => void),
    classList: {
      contains: (name: string) => classNames.has(name),
      add: (name: string) => classNames.add(name)
    },
    getAttribute: (name: string) => (name in node.attributes ? node.attributes[name] : null),
    setAttribute: (name: string, value: string) => {
      node.attributes[name] = value;
    },
    appendChild: (child: any) => {
      node.children.push(child);
      return child;
    },
    querySelector(selector: string) {
      return this.children.find((child: any) => {
        if (selector.startsWith('[') && selector.endsWith(']')) {
          const key = selector.slice(1, -1);
          return child.getAttribute(key) !== null;
        }
        return false;
      }) || null;
    },
    focus: () => {}
  };
  Object.defineProperty(node, 'className', {
    get() {
      return [...classNames].join(' ');
    },
    set(value: string) {
      classNames.clear();
      String(value || '').split(/\s+/).filter(Boolean).forEach((token) => classNames.add(token));
    }
  });
  Object.defineProperty(node, 'innerHTML', {
    get() {
      return '';
    },
    set() {
      node.children = [];
    }
  });
  return node;
}

function mount() {
  const list = el('ul', { 'data-tag-list': '' });
  const input = el('input', { 'data-tag-input': '', type: 'text' });
  const add = el('button', { 'data-tag-add': '', type: 'button' });
  const root = el('div');
  root.children.push(list, input, add);
  (globalThis as any).document = {
    createElement: (tag: string) => el(tag)
  };
  return {
    root, input, add, editor: createTagEditor({ root })
  };
}

describe('tagEditor', () => {
  it('returns an inert API when root is missing', () => {
    expect.hasAssertions();
    const editor = createTagEditor({ root: null as any });
    expect(editor.getValues()).toStrictEqual([]);
    editor.setValues(['x']);
    editor.clear();
    editor.setDisabled(true);
    expect(editor.getValues()).toStrictEqual([]);
  });

  it('adds unique values via Add and removes via setValues/clear', () => {
    expect.hasAssertions();
    const { input, add, editor } = mount();
    input.value = 'alpha';
    add.onclick();
    input.value = 'beta';
    add.onclick();
    input.value = 'alpha';
    add.onclick();
    expect(editor.getValues()).toStrictEqual(['alpha', 'beta']);

    editor.setValues(['one', ' two ', '', 'one']);
    expect(editor.getValues()).toStrictEqual(['one', 'two']);
    editor.clear({ silent: true });
    expect(editor.getValues()).toStrictEqual([]);
  });

  it('adds on Enter, ignores other keys, and removes via chip button', () => {
    expect.hasAssertions();
    const changes: string[][] = [];
    const { root, input } = mount();
    const wired = createTagEditor({
      root,
      onChange: (next: string[]) => { changes.push(next); }
    });
    input.value = 'gamma';
    input.onkeydown({ key: 'a', preventDefault() {} });
    expect(wired.getValues()).toStrictEqual([]);
    input.onkeydown({ key: 'Enter', preventDefault() {} });
    expect(wired.getValues()).toStrictEqual(['gamma']);
    expect(changes[changes.length - 1]).toStrictEqual(['gamma']);

    const list = root.querySelector('[data-tag-list]');
    const chip = list.children.find((child: any) => child.classList.contains('tag-chip'));
    expect(chip).toBeTruthy();
    const remove = chip.children.find((child: any) => child.classList.contains('tag-chip-remove'));
    remove.onclick();
    expect(wired.getValues()).toStrictEqual([]);
  });

  it('setDisabled blocks add and clear emits unless silent', () => {
    expect.hasAssertions();
    const changes: string[][] = [];
    const { root, input, add } = mount();
    const editor = createTagEditor({
      root,
      onChange: (next: string[]) => { changes.push([...next]); }
    });
    input.value = 'keep';
    add.onclick();
    expect(changes).toHaveLength(1);

    editor.setDisabled(true);
    expect(input.disabled).toBe(true);
    expect(add.disabled).toBe(true);
    input.value = 'blocked';
    add.onclick();
    expect(editor.getValues()).toStrictEqual(['keep']);

    editor.setDisabled(false);
    editor.clear();
    expect(editor.getValues()).toStrictEqual([]);
    expect(changes[changes.length - 1]).toStrictEqual([]);
    const beforeSilent = changes.length;
    editor.setValues(['z'], { silent: true });
    expect(changes.length).toBe(beforeSilent);
    editor.clear({ silent: true });
    expect(editor.getValues()).toStrictEqual([]);
  });

  it('tolerates missing list/input/add nodes and non-array setValues', () => {
    expect.hasAssertions();
    const root = el('div');
    (globalThis as any).document = { createElement: (tag: string) => el(tag) };
    const editor = createTagEditor({ root, emptyLabel: 'Empty' });
    expect(editor.getValues()).toStrictEqual([]);
    editor.setValues('not-an-array' as any);
    expect(editor.getValues()).toStrictEqual([]);
    editor.setDisabled(true);
    editor.clear();
    expect(editor.getValues()).toStrictEqual([]);
  });
});
