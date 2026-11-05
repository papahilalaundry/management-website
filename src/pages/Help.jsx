import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Building2, ClipboardList, KeyRound, LifeBuoy, Map, MessageSquareQuote, PlayCircle, Shirt,
  UserPlus, Users, Wallet, WashingMachine,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTour } from '../components/tour/TourContext'
import { GUIDES } from '../components/tour/tourSteps'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import SearchInput from '../components/ui/SearchInput'
import EmptyState from '../components/ui/EmptyState'

const ICONS = {
  'new-order': ClipboardList,
  payment: Wallet,
  status: WashingMachine,
  feedback: MessageSquareQuote,
  clients: Users,
  services: Shirt,
  staff: UserPlus,
  business: Building2,
  password: KeyRound,
  reports: BarChart3,
}

export default function Help() {
  const { user, can } = useAuth()
  const { start, startMainTour } = useTour()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const guides = useMemo(() => {
    const q = query.trim().toLowerCase()
    return GUIDES.filter((g) => !g.permission || can(g.permission)).filter(
      (g) => !q || [g.title, g.summary, ...g.steps].some((t) => t.toLowerCase().includes(q)),
    )
  }, [query, can])

  const showMe = (g) => (g.tour ? start(g.tour) : navigate(g.to))

  return (
    <div className="space-y-6">
      <PageHeader title="Help & guides" description="Step-by-step instructions for everyday tasks." />

      <Card className="flex flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-soft text-brand">
          <Map size={22} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-ink">New here, {user.name.split(' ')[0]}?</p>
          <p className="text-[13px] text-muted">Take the two-minute tour: it walks you through the menu, orders, clients, payments and settings.</p>
        </div>
        <Button icon={PlayCircle} onClick={startMainTour} className="shrink-0">Take the tour</Button>
      </Card>

      <SearchInput value={query} onChange={setQuery} placeholder="Search guides, e.g. payment, shoes, password…" />

      {guides.length === 0 ? (
        <Card>
          <EmptyState icon={LifeBuoy} title="No guides match your search" description="Try another word, or take the tour." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {guides.map((g) => {
            const Icon = ICONS[g.id] ?? LifeBuoy
            return (
              <Card key={g.id} as="article" className="flex flex-col p-5" aria-labelledby={`guide-${g.id}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-soft text-brand">
                    <Icon size={18} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 id={`guide-${g.id}`} className="text-[15px] font-bold text-ink">{g.title}</h2>
                    <p className="text-[13px] text-muted">{g.summary}</p>
                  </div>
                </div>
                <ol className="mt-4 flex-1 space-y-2">
                  {g.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 flex justify-end border-t border-line pt-3">
                  <Button variant="soft" size="sm" iconRight={g.tour ? PlayCircle : ArrowRight} onClick={() => showMe(g)}>
                    {g.tour ? 'Show me' : 'Go there'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
