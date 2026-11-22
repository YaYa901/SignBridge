import type { Direction, Role } from './types'

const dateTime = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
const timeOnly = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' })

/** "اليوم، ١٠:٤٢ ص" / "أمس، …" / full date — from an ISO timestamp. */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (days === 0) return `اليوم، ${timeOnly.format(date)}`
  if (days === 1) return `أمس، ${timeOnly.format(date)}`
  return dateTime.format(date)
}

export const formatTime = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : timeOnly.format(date)
}

export const arNumber = (n: number): string => n.toLocaleString('ar-EG')

export function directionLabel(direction: Direction): string {
  return direction === 'text_to_sign' ? 'نص ← إشارة (توضيحي)' : 'إشارة ← نص (يدوي)'
}

export const roleLabel: Record<Role, string> = {
  user: 'مستخدم',
  student: 'متعلّم',
  instructor: 'مدرّب',
  admin: 'مسؤول',
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name

export function downloadBlob(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
