import { BellRing, CheckCircle2, ClipboardList, HandCoins, PackageX, TriangleAlert, UserCog, Wallet } from 'lucide-react'

const META = {
  new_order: { icon: ClipboardList, cls: 'bg-blue-50 text-blue-600' },
  order_ready: { icon: CheckCircle2, cls: 'bg-amber-50 text-amber-600' },
  overdue: { icon: TriangleAlert, cls: 'bg-red-50 text-red-600' },
  payment: { icon: Wallet, cls: 'bg-emerald-50 text-emerald-600' },
  outstanding: { icon: HandCoins, cls: 'bg-orange-50 text-orange-600' },
  low_stock: { icon: PackageX, cls: 'bg-rose-50 text-rose-600' },
  staff: { icon: UserCog, cls: 'bg-violet-50 text-violet-600' },
  system: { icon: BellRing, cls: 'bg-slate-100 text-slate-600' },
}

export function NotificationIcon({ category, size = 'md' }) {
  const m = META[category] ?? META.system
  const Icon = m.icon
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg ${m.cls} ${size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'}`}>
      <Icon size={size === 'lg' ? 18 : 15} aria-hidden />
    </span>
  )
}
