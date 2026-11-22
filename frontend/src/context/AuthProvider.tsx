import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler } from '../lib/api'
import type { User, UserSettings } from '../lib/types'
import { AuthContext, type AuthApi, type AuthStatus } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUserState] = useState<User | null>(null)
  const clear = useCallback(() => { setUserState(null); setStatus('anonymous') }, [])
  useEffect(() => {
    // Remove legacy bearer credentials once. No credentials are written to Web Storage.
    try { localStorage.removeItem('signbridge-token') } catch { /* storage disabled */ }
    let cancelled = false
    api.me().then(me => { if (!cancelled) { setUserState(me); setStatus('authenticated') } }).catch(() => { if (!cancelled) clear() })
    return () => { cancelled = true }
  }, [clear])
  useEffect(() => { setUnauthorizedHandler(clear); return () => setUnauthorizedHandler(null) }, [clear])
  const applyAuth = useCallback((next: User) => { setUserState(next); setStatus('authenticated') }, [])
  const login = useCallback(async (email: string, password: string) => { applyAuth((await api.login(email, password)).user) }, [applyAuth])
  const register = useCallback(async (email: string, password: string, displayName: string) => {
    applyAuth((await api.register(email, password, displayName)).user)
  }, [applyAuth])
  const logout = useCallback(() => {
    void api.logout().then(clear).catch(() => window.alert('تعذر إنهاء الجلسة على الخادم. حاول تسجيل الخروج مرة أخرى.'))
  }, [clear])
  const saveSettings = useCallback(async (patch: Partial<UserSettings>) => { setUserState(await api.updateSettings(patch)) }, [])
  const value = useMemo<AuthApi>(() => ({ status, user, login, register, logout, setUser: setUserState, applyAuth, saveSettings }),
    [status, user, login, register, logout, applyAuth, saveSettings])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
