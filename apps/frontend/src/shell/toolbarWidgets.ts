import type { Component } from 'vue';

import { effectiveScopes } from '@/contracts/rbac';

export type ToolbarPlacement = 'left' | 'right';

export interface ToolbarWidget {
  id: string;
  component: Component;
  placement: ToolbarPlacement;
  order: number;
  requiredScopes?: string[];
  /** When set, the widget renders only while this module task is active. */
  moduleId?: string;
  props?: Record<string, unknown>;
}

const widgets: ToolbarWidget[] = [];

export const registerToolbarWidget = (widget: ToolbarWidget): void => {
  const index = widgets.findIndex((item) => item.id === widget.id);
  if (index >= 0) {
    widgets[index] = widget;
    return;
  }
  widgets.push(widget);
};

export const unregisterToolbarWidget = (id: string): void => {
  const index = widgets.findIndex((item) => item.id === id);
  if (index >= 0) widgets.splice(index, 1);
};

export const resetToolbarWidgets = (): void => {
  widgets.splice(0, widgets.length);
};

export const toolbarWidgets = (): readonly ToolbarWidget[] => widgets;

export const listToolbarWidgets = (
  roles: string[] | undefined,
  activeModuleId: string | null,
  placement: ToolbarPlacement
): ToolbarWidget[] => {
  const granted = effectiveScopes(roles ?? []);
  const star = granted.includes('*');
  return widgets
    .filter((widget) => widget.placement === placement)
    .filter((widget) => !widget.moduleId || widget.moduleId === activeModuleId)
    .filter((widget) => {
      if (!widget.requiredScopes || widget.requiredScopes.length === 0) return true;
      if (star) return true;
      return widget.requiredScopes.every((scope) => granted.includes(scope));
    })
    .slice()
    .sort((left, right) => left.order - right.order);
};
