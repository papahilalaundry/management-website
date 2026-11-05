/**
 * Public API of the data layer (Firestore). UI code imports from here only.
 * Lists are paged: list*() return { rows, cursor, hasMore } and count*() the total.
 */
export { ApiError } from './mockApi'
export { authService } from './authService'
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
