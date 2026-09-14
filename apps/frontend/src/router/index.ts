import { createRouter, createWebHashHistory } from 'vue-router';
import { defineComponent } from 'vue';

import DefaultLayout from '@/layouts/DefaultLayout.vue';
import { requireAuthRedirect, requireScopeRedirect, requireSyncRedirect } from '@/router/guards';
import { organizationsCrudConfig } from '@/features/organizations/organizationsCrudConfig';
import { usersCrudConfig } from '@/features/users/usersCrudConfig';
import '@/modules/index';

/** Keep-alive panes live in DefaultLayout; this route only binds URL params. */
const ModuleOutlet = defineComponent({
  name: 'ModuleOutlet',
  setup: () => () => null
});

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/features/auth/LoginView.vue'),
    meta: { public: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/features/auth/RegisterView.vue'),
    meta: { public: true }
  },
  {
    path: '/sync',
    name: 'Sync',
    component: () => import('@/views/SyncProgressView.vue')
  },
  {
    path: '/',
    name: 'Home',
    component: DefaultLayout,
    redirect: '/m/users/dashboard',
    meta: { titleKey: 'nav.home' },
    children: [
      {
        path: '/m/:moduleId/:tab?',
        name: 'Module',
        component: ModuleOutlet,
        meta: { titleKey: 'nav.home' }
      },
      {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/features/profile/ProfileView.vue'),
        meta: { titleKey: 'nav.profile' }
      },
      {
        path: '/dashboard',
        redirect: '/m/users/dashboard'
      },
      {
        path: '/users',
        name: 'UsersRedirect',
        redirect: '/m/users/users',
        meta: { operationId: usersCrudConfig.operations.list }
      },
      {
        path: '/organizations',
        name: 'OrganizationsRedirect',
        redirect: '/m/users/organizations',
        meta: { operationId: organizationsCrudConfig.operations.list }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/features/dashboard/NotFoundView.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
});

router.beforeEach(async (to) => (
  requireAuthRedirect(to)
  ?? (await requireSyncRedirect(to))
  ?? (await requireScopeRedirect(to))
  ?? true
));

export default router;
