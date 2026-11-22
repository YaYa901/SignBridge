import { createContext, useContext } from 'react'
import type { User, UserSettings } from '../lib/types'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

export interface AuthApi {
  status: AuthStatus
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
  /** Replace the cached user after an account change (name, password, ...). */
  setUser: (user: User) => void
  /** Apply the user returned after a cookie-session account change. */
  applyAuth: (user: User) => void
  saveSettings: (patch: Partial<UserSettings>) => Promise<void>
}

export const AuthContext = createContext<AuthApi | null>(null)

export function useAuth(): AuthApi {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
