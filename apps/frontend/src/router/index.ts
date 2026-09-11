import { createRouter, createWebHashHistory } from 'vue-router';

import DefaultLayout from '@/layouts/DefaultLayout.vue';
import { requireAuthRedirect, requireScopeRedirect } from '@/router/guards';

/**
 * Public routes bypass the shell; everything under DefaultLayout requires an
 * authenticated session (requirement: dashboard only after /auth/login).
 */
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
    path: '/',
    name: 'Home',
    component: DefaultLayout,
    redirect: '/dashboard',
    children: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/features/dashboard/DashboardView.vue')
      },
      {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/features/profile/ProfileView.vue')
      },
      {
        path: '/users',
        name: 'Users',
        component: () => import('@/features/users/UsersView.vue'),
        meta: { operationId: 'getAll' }
      },
      {
        path: '/organizations',
        name: 'Organizations',
        component: () => import('@/features/organizations/OrganizationsView.vue'),
        meta: { operationId: 'getAllOrganizations' }
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
  requireAuthRedirect(to) ?? (await requireScopeRedirect(to)) ?? true
));

export default router;
