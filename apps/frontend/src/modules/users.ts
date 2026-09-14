import { organizationsCrudConfig } from '@/features/organizations/organizationsCrudConfig';
import { usersCrudConfig } from '@/features/users/usersCrudConfig';
import type { ModuleManifest } from '@/modules/manifest';

export const usersModule: ModuleManifest = {
  id: 'users',
  title: { en: 'Users', 'pt-BR': 'Usuários' },
  icon: 'cil-people',
  entities: [
    {
      id: 'users',
      title: { en: 'Users', 'pt-BR': 'Usuários' },
      config: usersCrudConfig,
      load: () => import('@/features/users/UsersView.vue')
    },
    {
      id: 'organizations',
      title: { en: 'Organizations', 'pt-BR': 'Organizações' },
      config: organizationsCrudConfig,
      load: () => import('@/features/organizations/OrganizationsView.vue')
    }
  ],
  dashboard: {
    load: () => import('@/features/dashboard/DashboardView.vue')
  }
};
