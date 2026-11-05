/**
 * Guided tour content.
 *
 * A step: { id, title, body, target?: string[] (CSS selectors, first visible
 * one wins — e.g. desktop sidebar item, then the phone tab bar), route?: path
 * to open first, permission?: only shown if the user has it }.
 * Steps without a visible target show as a centred card.
 */

const ROLE_INTRO = {
  admin: 'As an admin you can use everything: orders, clients, payments, reports, services and prices, staff accounts and settings.',
  manager: 'As a manager you can take orders, manage clients and payments, and see expenses, inventory and reports.',
  staff: 'You can take orders, look up clients, record payments and move orders through washing, drying, ironing and delivery.',
}

const NEW_ORDER = ['[data-tour="new-order"]', '[data-tour="tab-new"]']
const MENU = ['[data-tour="menu"]', '[data-tour="tab-more"]']

/** The full walkthrough, adjusted to the user's role. */
export function mainTourSteps(user) {
  const first = user?.name?.split(' ')[0] ?? 'there'
  return [
    {
      id: 'welcome',
      title: `Welcome to Papa Hila, ${first}!`,
      body: `${ROLE_INTRO[user?.role] ?? ROLE_INTRO.staff} This short tour shows you around — it takes about two minutes.`,
    },
    {
      id: 'menu',
      route: '/dashboard',
      target: MENU,
      title: 'The menu',
      body: 'Every part of the system is here. On a phone, the bar at the bottom has the main pages and “More” opens the full menu.',
    },
    {
      id: 'dashboard',
      route: '/dashboard',
      target: ['section[aria-label="Order statistics"]'],
      permission: 'dashboard.view',
      title: 'Your dashboard',
      body: 'Today at a glance: orders, kilograms of laundry, what’s waiting, in progress and ready. Managers also see money received, balances and expenses.',
    },
    {
      id: 'new-order-button',
      target: NEW_ORDER,
      permission: 'orders.create',
      title: 'Start a new order',
      body: 'Use this button whenever a client drops something off.',
    },
    {
      id: 'order-services',
      route: '/orders/new',
      target: ['section[aria-labelledby="step-2"]'],
      permission: 'orders.create',
      title: 'One order, many services',
      body: 'Add each service the client wants — laundry by kg, shoes by pair, carpets by m², curtains by panel and so on. Each is charged in its own unit, and the total adds up automatically.',
    },
    {
      id: 'order-items',
      route: '/orders/new',
      target: ['section[aria-labelledby="step-3"]', 'section[aria-labelledby="step-2"]'],
      permission: 'orders.create',
      title: 'Count the garments',
      body: 'For laundry, list the pieces (trousers, t-shirts, bedsheets…). They aren’t priced, but they’re tracked so nothing goes missing.',
    },
    {
      id: 'order-payment',
      route: '/orders/new',
      target: ['section[aria-labelledby="step-6"]'],
      permission: 'payments.record',
      title: 'Payment at drop-off',
      body: 'Choose Pay later, Deposit or Pay in full. Record the mode — Paybill, M-Pesa number or cash — the estimated amount and what was actually paid. For M-Pesa, type the name from the M-Pesa message.',
    },
    {
      id: 'orders',
      route: '/orders',
      target: ['[aria-label="Filter by status"]'],
      permission: 'orders.view',
      title: 'Track every order',
      body: 'Filter orders by stage — received, washing, drying, ironing, ready, delivered. Use Filters for overdue orders, payment status, service or dates. Open an order to update its progress or record feedback.',
    },
    {
      id: 'clients',
      route: '/customers',
      target: ['[aria-label="Filter by client type"]', 'section[aria-label="Customer statistics"]'],
      permission: 'customers.view',
      title: 'New and regular clients',
      body: 'Clients become “Regular” from their second visit. Each client shows how often they bring laundry, their last visit, balance and feedback.',
    },
    {
      id: 'payments',
      route: '/payments',
      target: ['section[aria-label="Payment statistics"]'],
      permission: 'payments.view',
      title: 'Payments',
      body: 'Money received by Paybill, M-Pesa number and cash, with the estimated vs actually-paid amount for every payment and the balances still owed.',
    },
    {
      id: 'services',
      route: '/services',
      target: ['[data-tour="nav-services"]'],
      permission: 'services.view',
      title: 'Services & prices',
      body: 'Each service is measured its own way — kg, pair, piece, m², panel, a fixed job or your own unit — with an optional minimum charge, and can let staff set the price on each order (handy for shoes).',
    },
    {
      id: 'staff',
      route: '/staff',
      target: ['[data-tour="nav-staff"]'],
      permission: 'staff.manage',
      title: 'Staff accounts',
      body: 'Add staff with a username and a temporary password, and choose their role. To stop someone signing in, deactivate them.',
    },
    {
      id: 'settings',
      route: '/settings',
      target: ['[aria-label="Settings sections"]'],
      permission: 'settings.view',
      title: 'Settings',
      body: 'Add your business details, Paybill number and account number (they appear on receipts), and change your password under “My profile”.',
    },
    {
      id: 'search',
      target: ['[data-tour="search"]', '[data-tour="search-mobile"]'],
      title: 'Find anything fast',
      body: 'Search by order number, phone number or client name from any page.',
    },
    {
      id: 'notifications',
      target: ['[data-tour="notifications"]'],
      title: 'Notifications',
      body: 'New orders, orders ready for collection, payments and low stock appear here.',
    },
    {
      id: 'help',
      target: ['[data-tour="nav-help"]', '[data-tour="tab-more"]'],
      title: 'Help is always here',
      body: 'Help & guides has step-by-step instructions for everyday tasks, each with a “Show me” button.',
    },
    {
      id: 'done',
      route: '/dashboard',
      title: 'You’re all set!',
      body: 'You can take this tour again any time from your account menu (top right) or from Help & guides.',
    },
  ]
}

/**
 * Step-by-step guides for the Help page. `tour` steps power the “Show me”
 * button; `to` opens the page instead.
 */
export const GUIDES = [
  {
    id: 'new-order',
    title: 'Taking a new order',
    summary: 'Register the client, add every service, count the garments and take payment.',
    permission: 'orders.create',
    steps: [
      'Click New Order (on a phone, the blue + button).',
      'Pick the client — search by name or phone — or register a new one.',
      'Under Services, add each service: e.g. Laundry 6.5 kg, Shoe cleaning 2 pairs, Carpet 3 m². Use “Add service” for more.',
      'If the service lists garments, count the pieces (trousers, t-shirts…) under Garments & items.',
      'Set the date received, when it will be ready, and the delivery date if you’re delivering.',
      'Choose Pay later, Deposit or Pay in full, then save. Print the receipt if the client wants one.',
    ],
    tour: [
      { target: NEW_ORDER, title: 'Start here', body: 'Click New Order whenever a client drops something off.' },
      { route: '/orders/new', target: ['section[aria-labelledby="step-1"]'], title: 'Client', body: 'Search for the client by name or phone, or register a new one.' },
      { route: '/orders/new', target: ['section[aria-labelledby="step-2"]'], title: 'Services', body: 'Add each service and its quantity — kg, pairs, m², panels… The total adds up automatically.' },
      { route: '/orders/new', target: ['section[aria-labelledby="step-6"]', 'aside[aria-label="Order summary"]'], title: 'Payment and save', body: 'Record any payment now, check the summary, then save the order.' },
    ],
  },
  {
    id: 'payment',
    title: 'Recording a payment',
    summary: 'Paybill, M-Pesa number or cash — with the estimated and actual amount.',
    permission: 'payments.record',
    steps: [
      'Open the order (or go to Payments) and click Record payment.',
      'Choose the mode: Paybill, M-Pesa number or Cash.',
      'Enter the estimated amount (what the client was expected to pay) and the amount actually paid.',
      'For Paybill or M-Pesa number, type the name shown on the M-Pesa message. The M-Pesa code is optional.',
      'Check the date of payment and save. The balance updates straight away.',
    ],
    to: '/orders',
  },
  {
    id: 'status',
    title: 'Updating order progress & delivery',
    summary: 'Move an order through washing, drying, ironing, ready and delivered.',
    permission: 'orders.updateStatus',
    steps: [
      'Open the order from Orders.',
      'Click Update status and choose the next stage — or update individual garments; the order follows the slowest garment.',
      'When the client collects or you deliver, mark it Delivered. The delivery date is recorded automatically.',
      'Overdue orders are highlighted in red on the dashboard and under Orders → Filters → Overdue only.',
    ],
    tour: [
      { route: '/orders', target: ['[aria-label="Filter by status"]'], title: 'Find the order', body: 'Filter by stage, then open an order to update its progress.' },
    ],
  },
  {
    id: 'feedback',
    title: 'Recording client feedback',
    summary: 'Save the client’s rating and comments on an order.',
    permission: 'orders.edit',
    steps: [
      'Open the order.',
      'In the Client feedback card, choose a rating from 1 to 5 and type what the client said.',
      'Save. Feedback shows on the client’s profile and in Reports.',
    ],
    to: '/orders',
  },
  {
    id: 'clients',
    title: 'Understanding new vs regular clients',
    summary: 'How clients become regular and how often they bring laundry.',
    permission: 'customers.view',
    steps: [
      'A client is “New” until their second order, then “Regular”.',
      'Each client shows “brings laundry every ~N days” — the average gap between their visits.',
      'Open a client to see every visit, the days between visits, their payments, balance and feedback.',
      'Use the New / Regular tabs on Customers to filter.',
    ],
    tour: [
      { route: '/customers', target: ['[aria-label="Filter by client type"]'], title: 'New and regular', body: 'Switch between all, new and regular clients here.' },
    ],
  },
  {
    id: 'services',
    title: 'Adding or editing a service',
    summary: 'Units, prices, minimum charges and per-order prices.',
    permission: 'services.manage',
    steps: [
      'Go to Services & Pricing and click Add service (or edit an existing one).',
      'Choose how it’s measured: kg, pair, piece, m², panel, fixed job, or a custom unit (e.g. “seat”).',
      'Enter the price per unit and, if needed, a minimum charge (e.g. carpets at least KES 1,000).',
      'Turn on “Staff can change the price on each order” for items whose cost varies, like shoes.',
      'Turn on “List garments/items” for laundry and ironing so pieces are counted.',
    ],
    to: '/services',
  },
  {
    id: 'staff',
    title: 'Adding a staff member',
    summary: 'Create a username and temporary password, and choose a role.',
    permission: 'staff.manage',
    steps: [
      'Go to Staff Management and click Add staff.',
      'Enter their name, a username (they sign in with this) and a temporary password.',
      'Choose the role: Staff, Manager or Admin.',
      'Give them the username and password; they can change the password in Settings → My profile.',
      'You can’t reset someone else’s password from the app. If they forget it or leave, deactivate them and create a new account.',
    ],
    to: '/staff',
  },
  {
    id: 'business',
    title: 'Setting up business details',
    summary: 'Name, phone, address, Paybill number and account for receipts.',
    permission: 'settings.business',
    steps: [
      'Go to Settings → Business profile.',
      'Fill in the business name, phone, address and hours.',
      'Enter your Paybill number and, if your Paybill uses one, the account number. Both are printed on receipts so clients know where to pay.',
      'Add your M-Pesa number if clients can send money to a phone.',
      'Save changes.',
    ],
    to: '/settings?tab=business',
  },
  {
    id: 'password',
    title: 'Changing your password',
    summary: 'Set a new password for your own account.',
    permission: 'settings.view',
    steps: [
      'Go to Settings → My profile.',
      'Under Change password, enter your current password and the new one twice.',
      'Use at least 8 characters with a capital letter and a number, then save.',
    ],
    to: '/settings?tab=profile',
  },
  {
    id: 'reports',
    title: 'Reading the dashboard & reports',
    summary: 'Orders, kilograms, money received and what’s outstanding.',
    permission: 'dashboard.view',
    steps: [
      'The dashboard shows the chosen period (top right): orders, kilograms, and what’s pending, in progress and ready right now.',
      'Managers also see revenue, outstanding balances, expenses, profit and the split by payment mode.',
      'Reports (managers and admins) break things down by service, garment, staff member, client type and feedback, and can be exported to Excel or PDF.',
    ],
    tour: [
      { route: '/dashboard', target: ['section[aria-label="Order statistics"]'], title: 'Today at a glance', body: 'Pick the period with the date filter at the top. Cards marked “now” show the current situation.' },
    ],
  },
]
