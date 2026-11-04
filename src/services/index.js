/**
 * Public API of the (mock) backend. UI code imports from here only.
 * Swap these implementations for real HTTP clients to go live.
 */
export { ApiError } from './mockApi'
export { authService, DEMO_ACCOUNTS } from './authService'
export { orderService } from './orderService'
export { customerService } from './customerService'
export { paymentService } from './paymentService'
export { catalogService } from './catalogService'
export { expenseService } from './expenseService'
export { inventoryService } from './inventoryService'
export { staffService } from './staffService'
export { notificationService } from './notificationService'
export { settingsService } from './settingsService'
export { reportService } from './reportService'
export { activityService } from './activityService'
export { CHANGE_EVENT } from './storage'
