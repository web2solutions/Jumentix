/* eslint-disable jest/prefer-expect-assertions, @typescript-eslint/no-explicit-any */
/**
 * Domain context association: sample-shaped strings/arrays become tag values
 * the inspector can show without comma-string typing.
 */

import { parseCommaSeparated } from '@jumentix/designer-core/state/designerState.js';
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
    checked: false,
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
    querySelectorAll(selector: string) {
      if (selector.includes('checkbox') && selector.includes('data-domain-name')) {
        return this.children.filter((child: any) => (
          child.tagName === 'INPUT'
          && child.getAttribute('type') === 'checkbox'
          && child.getAttribute('data-domain-name')
          && child.checked
        ));
      }
      return [];
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

function mountEditor() {
  const list = el('ul', { 'data-tag-list': '' });
  const input = el('input', { 'data-tag-input': '', type: 'text' });
  const add = el('button', { 'data-tag-add': '', type: 'button' });
  const root = el('div');
  root.children.push(list, input, add);
  (globalThis as any).document = {
    createElement: (tag: string) => el(tag)
  };
  return createTagEditor({ root, emptyLabel: 'empty' });
}

describe('domain context form association', () => {
  it('loads sample-shaped context into chips without requiring comma-string typing', () => {
    expect.hasAssertions();
    const ubiquitous = mountEditor();
    const packages = mountEditor();
    const context = {
      ubiquitousLanguage: 'project, task, assignee, comment',
      packageDependencies: ['@acme/identity-contracts'],
      upstreamDependencies: 'Users, Billing'
    };
    // asStringList adapter: CSV string or array → unique string[]
    const asStringList = (raw: unknown) => [...new Set(parseCommaSeparated(raw))];
    ubiquitous.setValues(asStringList(context.ubiquitousLanguage), { silent: true });
    packages.setValues(asStringList(context.packageDependencies), { silent: true });
    expect(ubiquitous.getValues()).toStrictEqual(['project', 'task', 'assignee', 'comment']);
    expect(packages.getValues()).toStrictEqual(['@acme/identity-contracts']);
    expect(asStringList(context.upstreamDependencies)).toStrictEqual(['Users', 'Billing']);
    // Model boundary: ubiquitousLanguage serializes back to one string; lists stay arrays.
    expect(asStringList(ubiquitous.getValues()).join(', ')).toBe('project, task, assignee, comment');
    expect(asStringList(packages.getValues())).toStrictEqual(['@acme/identity-contracts']);
  });

  it('reads checked domain names as the associated upstream set', () => {
    expect.hasAssertions();
    const list = el('div');
    for (const [name, checked] of [['Users', true], ['Billing', false]] as const) {
      const input = el('input', { type: 'checkbox', 'data-domain-name': name });
      input.checked = checked;
      list.appendChild(input);
    }
    const checked = list.querySelectorAll('input[type="checkbox"][data-domain-name]:checked')
      .map((input: any) => input.getAttribute('data-domain-name'));
    expect(checked).toStrictEqual(['Users']);
  });
});
