/* Domain constants shared by the data layer and UI. */

export const ROLES = {
  admin: { value: 'admin', label: 'Admin' },
  manager: { value: 'manager', label: 'Manager' },
  staff: { value: 'staff', label: 'Staff' },
}
export const ROLE_OPTIONS = Object.values(ROLES)

/** Laundry workflow, in order. */
export const ORDER_STAGES = [
  { value: 'received', label: 'Received', short: 'Received' },
  { value: 'washing', label: 'Washing', short: 'Washing' },
  { value: 'drying', label: 'Drying', short: 'Drying' },
  { value: 'ironing', label: 'Ironing', short: 'Ironing' },
  { value: 'ready', label: 'Ready for Collection', short: 'Ready' },
  { value: 'delivered', label: 'Delivered', short: 'Delivered' },
]
export const STAGE_VALUES = ORDER_STAGES.map((s) => s.value)
export const stageIndex = (status) => STAGE_VALUES.indexOf(status)
export const stageLabel = (status) =>
  status === 'cancelled' ? 'Cancelled' : ORDER_STAGES.find((s) => s.value === status)?.label ?? status
export const stageShort = (status) =>
  status === 'cancelled' ? 'Cancelled' : ORDER_STAGES.find((s) => s.value === status)?.short ?? status

export const ORDER_STATUS_OPTIONS = [
  ...ORDER_STAGES.map(({ value, short }) => ({ value, label: short })),
  { value: 'cancelled', label: 'Cancelled' },
]
/** Statuses where work is still being done */
export const IN_PROGRESS_STATUSES = ['washing', 'drying', 'ironing']
export const OPEN_STATUSES = ['received', 'washing', 'drying', 'ironing']

export const PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
]

/** How customers pay for laundry. Paybill and M-Pesa number payments record the payer's name. */
export const PAYMENT_METHODS = [
  { value: 'paybill', label: 'Paybill' },
  { value: 'mpesa_number', label: 'M-Pesa number' },
  { value: 'cash', label: 'Cash' },
]
export const PAYMENT_METHOD_VALUES = PAYMENT_METHODS.map((m) => m.value)
/** Methods that go through Safaricom M-Pesa (payer name required, optional M-Pesa code). */
export const MPESA_METHODS = ['paybill', 'mpesa_number']
export const isMpesaMethod = (m) => MPESA_METHODS.includes(m)
export const EXPENSE_PAYMENT_METHODS = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
]
export const methodLabel = (m) =>
  [...PAYMENT_METHODS, ...EXPENSE_PAYMENT_METHODS].find((x) => x.value === m)?.label ?? (m === 'mpesa' ? 'M-Pesa' : m)

export const PRIORITIES = [
  { value: 'normal', label: 'Normal', days: 2 },
  { value: 'express', label: 'Express', days: 1 },
  { value: 'urgent', label: 'Urgent', days: 0 },
]

/**
 * How a service is measured and charged. Each service picks one; "custom"
 * lets the business type its own unit (e.g. "seat" for sofa cleaning).
 *   decimals: whether quantities can be fractional (2.5 kg, 3.2 m²)
 */
export const PRICING_UNITS = [
  { value: 'kg', label: 'By weight (kg)', unit: 'kg', plural: 'kg', decimals: true, example: 'Laundry, wash & fold' },
  { value: 'pair', label: 'Per pair', unit: 'pair', plural: 'pairs', decimals: false, example: 'Shoes, sneakers, socks' },
  { value: 'piece', label: 'Per piece / item', unit: 'piece', plural: 'pieces', decimals: false, example: 'Suits, duvets, blankets' },
  { value: 'sqm', label: 'By area (m²)', unit: 'm²', plural: 'm²', decimals: true, example: 'Carpets, rugs' },
  { value: 'panel', label: 'Per panel', unit: 'panel', plural: 'panels', decimals: false, example: 'Curtains' },
  { value: 'job', label: 'Fixed price per job', unit: 'job', plural: 'jobs', decimals: false, example: 'Sofa set, mattress' },
  { value: 'custom', label: 'Custom unit…', unit: '', plural: '', decimals: true, example: 'Any other unit you name' },
]
export const pricingUnitMeta = (value) => PRICING_UNITS.find((u) => u.value === value) ?? PRICING_UNITS[2]
/** Display unit of a service or order line, e.g. "kg", "pair", "seat". */
export const unitLabel = (svcOrLine) => (svcOrLine?.unit === 'custom' ? svcOrLine.unitLabel || 'unit' : pricingUnitMeta(svcOrLine?.unit).unit)
/** "2 pairs", "6.5 kg", "1 seat" */
export function formatQuantity(qty, svcOrLine) {
  const meta = pricingUnitMeta(svcOrLine?.unit)
  const n = Number(qty) || 0
  if (svcOrLine?.unit === 'custom') return `${n} ${svcOrLine.unitLabel || 'unit'}${n === 1 || !svcOrLine.unitLabel ? '' : 's'}`
  return `${n} ${n === 1 ? meta.unit : meta.plural}`
}
/** Older services/orders stored pricingModel instead of unit. */
export const unitOf = (svc) => svc?.unit ?? (svc?.pricingModel === 'per_kg' ? 'kg' : svc?.pricingModel === 'fixed' ? 'job' : 'piece')

export const DEFAULT_RATE_PER_KG = 50

/* ---- Clients ---- */
export const CLIENT_TYPES = [
  { value: 'new', label: 'New client' },
  { value: 'regular', label: 'Regular client' },
]
/** A client becomes "regular" from this many (non-cancelled) orders. */
export const REGULAR_AFTER_ORDERS = 2
export const clientTypeLabel = (t) => CLIENT_TYPES.find((c) => c.value === t)?.label ?? 'New client'

/* ---- Client feedback on an order ---- */
export const FEEDBACK_RATINGS = [
  { value: 5, label: 'Excellent' },
  { value: 4, label: 'Good' },
  { value: 3, label: 'Okay' },
  { value: 2, label: 'Poor' },
  { value: 1, label: 'Very poor' },
]

/* ---- Sign-in: staff type a username; Firebase Auth uses username@domain ---- */
export const LOGIN_EMAIL_DOMAIN = 'papahilalaundry.com'
export const normalizeUsername = (u = '') => String(u).trim().toLowerCase().replace(/@.*$/, '')
export const usernameToEmail = (u) => `${normalizeUsername(u)}@${LOGIN_EMAIL_DOMAIN}`

export const GARMENT_CATALOG = {
  Clothing: [
    'Shirt', 'T-shirt', 'Trousers', 'Jeans', 'Dress', 'Skirt', 'Suit (2-piece)', 'Suit (3-piece)',
    'Jacket', 'Sweater', 'School uniform', 'Blouse', 'Coat', 'Kanzu', 'Tie',
  ],
  Household: ['Bedsheet', 'Duvet cover', 'Duvet', 'Blanket', 'Pillowcase', 'Curtain', 'Towel', 'Table cloth', 'Mixed load'],
  Other: ['Custom item'],
}
export const GARMENT_CATEGORIES = Object.keys(GARMENT_CATALOG)

export const EXPENSE_CATEGORIES = [
  'Detergents & Chemicals',
  'Water',
  'Electricity',
  'Rent',
  'Salaries & Wages',
  'Repairs & Maintenance',
  'Equipment',
  'Packaging Materials',
  'Transport',
  'Other',
]

export const INVENTORY_CATEGORIES = ['Detergents', 'Chemicals', 'Packaging', 'Accessories', 'Protective Gear', 'Cleaning']
export const INVENTORY_UNITS = ['litres', 'kg', 'pieces', 'packs', 'rolls', 'pairs', 'bottles']

export const STOCK_MOVEMENT_TYPES = [
  { value: 'received', label: 'Stock received' },
  { value: 'used', label: 'Stock used' },
  { value: 'adjustment', label: 'Adjustment' },
]

export const NOTIFICATION_CATEGORIES = [
  { value: 'new_order', label: 'New order' },
  { value: 'order_ready', label: 'Order ready' },
  { value: 'overdue', label: 'Order overdue' },
  { value: 'payment', label: 'Payment received' },
  { value: 'outstanding', label: 'Outstanding balance' },
  { value: 'low_stock', label: 'Low inventory' },
  { value: 'staff', label: 'Staff activity' },
  { value: 'system', label: 'System alert' },
]

export const SMS_TEMPLATES = {
  order_received: {
    label: 'Order received',
    text: 'Hello {name}, we have received your laundry order #{orderId} at Papa Hila Laundry. Expected completion: {date}. Thank you!',
  },
  order_ready: {
    label: 'Order ready',
    text: 'Hello {name}, your laundry order #{orderId} is ready for collection. Thank you for choosing Papa Hila Laundry!',
  },
  payment_received: {
    label: 'Payment received',
    text: 'Hello {name}, we have received your payment of {amount} for order #{orderId}. Your remaining balance is {balance}. Thank you!',
  },
  order_delivered: {
    label: 'Order delivered',
    text: 'Hello {name}, your order #{orderId} has been marked as delivered. We appreciate your business!',
  },
}
