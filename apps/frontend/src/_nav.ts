import { organizationsCrudConfig } from '@/features/organizations/organizationsCrudConfig';
import { usersCrudConfig } from '@/features/users/usersCrudConfig';

export type NavComponent = 'CNavItem' | 'CNavGroup' | 'CNavTitle'

export interface NavBadge {
  color: string
  text: string
  shape?: string
}

export interface NavItem {
  component: NavComponent
  /** i18n key (JUM-780); resolved by `AppSidebarNav` through `t()`. */
  name: string
  to?: string
  href?: string
  external?: boolean
  icon?: string
  badge?: NavBadge
  items?: NavItem[]
  /** JUM-772: item only renders when the session roles satisfy this operationId. */
  operationId?: string
}

const navItems: NavItem[] = [
  {
    component: 'CNavItem',
    name: 'nav.dashboard',
    to: '/dashboard',
    icon: 'cil-speedometer'
  },
  {
    component: 'CNavGroup',
    name: 'nav.usersDomain',
    icon: 'cil-people',
    items: [
      {
        component: 'CNavItem',
        name: 'nav.users',
        to: '/users',
        operationId: usersCrudConfig.operations.list
      },
      {
        component: 'CNavItem',
        name: 'nav.organizations',
        to: '/organizations',
        operationId: organizationsCrudConfig.operations.list
      }
    ]
  }
];

export default navItems;
