import { Ban, CheckCircle2, Flame, PackageCheck, Truck, WashingMachine, Wind } from 'lucide-react'

/** Status colours (validated categorical palette: CVD-safe adjacent pairs). */
export const STATUS_META = {
  received: { tone: 'pink', icon: PackageCheck, color: '#ec4899' },
  washing: { tone: 'blue', icon: WashingMachine, color: '#2563eb' },
  drying: { tone: 'cyan', icon: Wind, color: '#06b6d4' },
  ironing: { tone: 'violet', icon: Flame, color: '#8b5cf6' },
  ready: { tone: 'amber', icon: CheckCircle2, color: '#f59e0b' },
  delivered: { tone: 'green', icon: Truck, color: '#10b981' },
  cancelled: { tone: 'red', icon: Ban, color: '#ef4444' },
}
