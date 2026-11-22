import type { ReactNode } from 'react'
import { ArrowLeftRight, FileText } from 'lucide-react'

export function StatCard({ label, value, note, icon, tint }: { label: string; value: string; note: string; icon: ReactNode; tint: string }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tint}`}>{icon}</div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-note">{note}</span>
    </div>
  )
}

export function QuickCard({ icon, title, text, action, onClick, tone }: { icon: ReactNode; title: string; text: string; action: string; onClick: () => void; tone: string }) {
  return (
    <button className={`quick-card ${tone}`} onClick={onClick}>
      <div className="quick-icon">{icon}</div>
      <strong>{title}</strong>
      <span>{text}</span>
      <div className="quick-action">{action}<ArrowLeftRight size={14} /></div>
    </button>
  )
}

export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="page-heading">
      <div className="eyebrow"><span className="eyebrow-dot" />{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><div><FileText size={19} /></div><span>{text}</span></div>
}

export function Spinner({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return <div className="spinner-wrap" role="status"><span className="spinner" aria-hidden="true" /><span>{label}</span></div>
}
