import { createContext, useContext } from 'react'

export interface ToastApi { notify: (message: string) => void }

export const ToastContext = createContext<ToastApi>({ notify: () => {} })
export const useToast = (): ToastApi => useContext(ToastContext)
