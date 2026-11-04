import { db } from './storage'
import { request } from './mockApi'
import { buildContext, staffName } from './helpers'
import { can } from '../utils/permissions'

const FINANCE_TYPES = ['payment', 'expense', 'settings', 'service']

export const activityService = {
  getActivities({ limit = 20, userId } = {}) {
    return request((user) => {
      const ctx = buildContext()
      return db
        .get('activities')
        .filter((a) => (!userId || a.by === userId) && (can(user, 'finance.view') || !FINANCE_TYPES.includes(a.type)))
        .slice(0, limit)
        .map((a) => ({ ...a, byName: staffName(ctx, a.by) }))
    }, { latency: [120, 260] })
  },
}
