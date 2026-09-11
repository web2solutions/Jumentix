export type NavComponent = 'CNavItem' | 'CNavGroup' | 'CNavTitle'

export interface NavBadge {
  color: string
  text: string
  shape?: string
}

export interface NavItem {
  component: NavComponent
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
    name: 'Dashboard',
    to: '/dashboard',
    icon: 'cil-speedometer'
  },
  {
    component: 'CNavGroup',
    name: 'Users Domain',
    icon: 'cil-people',
    items: [
      {
        component: 'CNavItem',
        name: 'Users',
        to: '/users',
        operationId: 'getAll'
      },
      {
        component: 'CNavItem',
        name: 'Organizations',
        to: '/organizations',
        operationId: 'getAllOrganizations'
      }
    ]
  }
];

export default navItems;
