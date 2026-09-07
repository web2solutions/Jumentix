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
}

const navItems: NavItem[] = [
  {
    component: 'CNavItem',
    name: 'Dashboard',
    to: '/dashboard',
    icon: 'cil-speedometer'
  }
];

export default navItems;
