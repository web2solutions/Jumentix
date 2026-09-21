import type { NavItem } from '@/modules/navTypes';
import { canOpenModule, registeredModules } from '@/modules/manifest';

export const navFromModules = (roles: string[] | undefined): NavItem[] => (
  registeredModules()
    .filter((mod) => canOpenModule(mod, roles))
    .map((mod) => ({
      component: 'CNavItem' as const,
      name: `module.${mod.id}`,
      to: `/m/${mod.id}`,
      icon: mod.icon
    }))
);
