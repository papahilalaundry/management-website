import {
  Bell, Boxes, ChartNoAxesCombined, ClipboardList, LayoutDashboard, ReceiptText, Settings, Shirt, UserCog, Users, Wallet,
} from 'lucide-react'

/** Sidebar navigation. Items are hidden when the user lacks `permission`. */
export const NAV_SECTIONS = [
  {
    title: 'Operations',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
      { to: '/orders', label: 'Orders', icon: ClipboardList, permission: 'orders.view' },
      { to: '/customers', label: 'Customers', icon: Users, permission: 'customers.view' },
      { to: '/services', label: 'Services & Pricing', icon: Shirt, permission: 'services.view' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/payments', label: 'Payments', icon: Wallet, permission: 'payments.view' },
      { to: '/expenses', label: 'Expenses', icon: ReceiptText, permission: 'expenses.view' },
      { to: '/reports', label: 'Reports & Analytics', icon: ChartNoAxesCombined, permission: 'reports.view' },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/inventory', label: 'Inventory', icon: Boxes, permission: 'inventory.view' },
      { to: '/staff', label: 'Staff Management', icon: UserCog, permission: 'staff.view' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell, permission: 'notifications.view', badge: 'notifications' },
      { to: '/settings', label: 'Settings', icon: Settings, permission: 'settings.view' },
    ],
  },
]

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
]
