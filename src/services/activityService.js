import { orderBy, query, where } from 'firebase/firestore'
import { col, fetchPage } from './storage'
import { request } from './mockApi'
import { staffName } from './helpers'
import { can } from '../utils/permissions'

const FINANCE_TYPES = ['payment', 'expense', 'settings', 'service']

export const activityService = {
  /**
   * Latest activity, newest first.
   * @param {object} params { limit, userId, customerId, orderId, cursor }
   * @returns {Promise<object[]>} rows (use listActivities for paging)
   */
  async getActivities(params = {}) {
    return (await activityService.listActivities({ ...params, pageSize: params.limit ?? 20 })).rows
  },

  /** Paged version: { rows, cursor, hasMore } */
  listActivities({ userId, customerId, orderId, pageSize = 20, cursor = null } = {}) {
    return request(async (user) => {
      const parts = []
      if (userId) parts.push(where('by', '==', userId))
      if (customerId) parts.push(where('customerId', '==', customerId))
      if (orderId) parts.push(where('orderId', '==', orderId))
      const page = await fetchPage(query(col('activities'), ...parts, orderBy('at', 'desc')), { pageSize, cursor })
      const finance = can(user, 'finance.view')
      return { ...page, rows: page.rows.filter((a) => finance || !FINANCE_TYPES.includes(a.type)).map((a) => ({ ...a, byName: staffName(a.by) })) }
    })
  },
}
