import {
  Bell, Boxes, ChartNoAxesCombined, ClipboardList, LayoutDashboard, LifeBuoy, ReceiptText, Settings, Shirt, UserCog, Users, Wallet,
} from 'lucide-react'

/**
 * Sidebar navigation. Items are hidden when the user lacks `permission`.
 * `tour` becomes data-tour="nav-<tour>" so the guided tour can point at it.
 */
export const NAV_SECTIONS = [
  {
    title: 'Operations',
    items: [
      { to: '/dashboard', tour: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
      { to: '/orders', tour: 'orders', label: 'Orders', icon: ClipboardList, permission: 'orders.view' },
      { to: '/customers', tour: 'customers', label: 'Customers', icon: Users, permission: 'customers.view' },
      { to: '/services', tour: 'services', label: 'Services & Pricing', icon: Shirt, permission: 'services.view' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/payments', tour: 'payments', label: 'Payments', icon: Wallet, permission: 'payments.view' },
      { to: '/expenses', tour: 'expenses', label: 'Expenses', icon: ReceiptText, permission: 'expenses.view' },
      { to: '/reports', tour: 'reports', label: 'Reports & Analytics', icon: ChartNoAxesCombined, permission: 'reports.view' },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/inventory', tour: 'inventory', label: 'Inventory', icon: Boxes, permission: 'inventory.view' },
      { to: '/staff', tour: 'staff', label: 'Staff Management', icon: UserCog, permission: 'staff.view' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/notifications', tour: 'notifications', label: 'Notifications', icon: Bell, permission: 'notifications.view', badge: 'notifications' },
      { to: '/settings', tour: 'settings', label: 'Settings', icon: Settings, permission: 'settings.view' },
      { to: '/help', tour: 'help', label: 'Help & guides', icon: LifeBuoy, permission: 'help.view' },
    ],
  },
]

/**
 * Mobile app shell helpers.
 * Form screens hide the bottom tab bar (they have their own sticky save bar),
 * and detail screens show a back button instead of the logo.
 */
export const isFormRoute = (path) => path === '/orders/new' || /^\/orders\/[^/]+\/edit$/.test(path)

/** Screens with their own bottom action bar on phones (forms + order details). */
export const hidesTabBar = (path) => isFormRoute(path) || /^\/orders\/[^/]+$/.test(path)

export function parentPath(path) {
  if (path === '/orders/new') return '/orders'
  const edit = path.match(/^\/orders\/([^/]+)\/edit$/)
  if (edit) return `/orders/${edit[1]}`
  if (/^\/orders\/[^/]+$/.test(path)) return '/orders'
  if (/^\/customers\/[^/]+$/.test(path)) return '/customers'
  return null
}

/** Titles for the top bar, matched by path prefix. */
export const PAGE_TITLES = [
  ['/orders/new', 'New Order'],
  ['/orders/', 'Order Details'],
  ['/orders', 'Orders'],
  ['/customers/', 'Customer Profile'],
  ['/customers', 'Customers'],
  ['/dashboard', 'Dashboard'],
  ['/services', 'Services & Pricing'],
  ['/payments', 'Payments'],
  ['/expenses', 'Expenses'],
  ['/inventory', 'Inventory'],
  ['/staff', 'Staff Management'],
  ['/reports', 'Reports & Analytics'],
  ['/notifications', 'Notifications'],
  ['/settings', 'Settings'],
  ['/help', 'Help & guides'],
]
