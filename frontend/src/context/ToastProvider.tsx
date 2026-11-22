import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { ToastContext } from './toast-context'

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const notify = useCallback((value: string) => setMessage(value), [])
  const api = useMemo(() => ({ notify }), [notify])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 4000)
    return () => window.clearTimeout(timer)
  }, [message])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {message && (
        <div className="toast" role="status" aria-live="polite">
          <span><Check size={16} /></span>
          {message}
          <button aria-label="إغلاق التنبيه" onClick={() => setMessage('')}><X size={15} /></button>
        </div>
      )}
    </ToastContext.Provider>
  )
}
