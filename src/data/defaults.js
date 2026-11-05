/** Settings used until (or where) the stored settings document has no value. */
export const DEFAULT_SETTINGS = {
  business: {
    name: 'Papa Hila Laundry',
    tagline: 'Fresh. Clean. On time.',
    phone: '',
    email: '',
    address: '',
    hours: '',
    currency: 'KES',
    kraPin: '',
    paybillNumber: '', // shown on receipts so clients know where to pay
    mpesaNumber: '',
    receiptFooter: 'Thank you for choosing Papa Hila Laundry!',
  },
  pricing: { taxRate: 0, taxLabel: 'VAT', expressSurcharge: 25, urgentSurcharge: 50, deliveryFee: 200 },
  notifications: { orders: true, payments: true, lowStock: true, overdue: true, sms: true, smsPreview: true },
  preferences: { dateFormat: 'dd MMM yyyy' },
}
