/**
 * Role-based access control. The UI hides anything a role cannot use and the
 * mock API re-checks the same permissions on every mutating call.
 *
 * NOTE: Client-side checks are for UX only. A production backend MUST enforce
 * these permissions server-side.
 */
const ALL = ['admin', 'manager', 'staff']
const MGMT = ['admin', 'manager']

export const PERMISSIONS = {
  'dashboard.view': ALL,
  'finance.view': MGMT, // revenue, expenses, profit, outstanding totals

  'orders.view': ALL,
  'orders.create': ALL,
  'orders.edit': ALL,
  'orders.updateStatus': ALL,
  'orders.discount': MGMT,
  'orders.cancel': MGMT,

  'customers.view': ALL,
  'customers.create': ALL,
  'customers.edit': ALL,

  'services.view': MGMT,
  'services.manage': ['admin'],

  'payments.view': MGMT,
  'payments.record': ALL,

  'expenses.view': MGMT,
  'expenses.manage': MGMT,

  'inventory.view': MGMT,
  'inventory.manage': MGMT,

  'staff.view': ['admin'],
  'staff.manage': ['admin'],

  'reports.view': MGMT,

  'notifications.view': ALL,

  'settings.view': ALL,
  'settings.business': ['admin'],
  'settings.users': ['admin'],
  'settings.notifications': MGMT,
  'settings.system': ['admin'],
}

export function can(user, permission) {
  if (!user) return false
  const roles = PERMISSIONS[permission]
  return Array.isArray(roles) && roles.includes(user.role)
}
