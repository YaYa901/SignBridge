import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe,it,expect,vi } from 'vitest'
import { AuthProvider } from '../context/AuthProvider'
import { AuthScreen } from './AuthScreen'
import { api } from '../lib/api'

describe('account forms',() => {
  it('rejects invalid registration without sending data',async () => {
    vi.spyOn(api,'me').mockRejectedValue(new Error('no session'))
    const register=vi.spyOn(api,'register')
    render(<MemoryRouter><AuthProvider><AuthScreen/></AuthProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab',{name:'حساب جديد'}))
    fireEvent.click(screen.getByRole('button',{name:'إنشاء الحساب'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('اكتب اسمك')
    expect(register).not.toHaveBeenCalled()
    expect(screen.getByRole('link',{name:'نسيت كلمة المرور؟'})).toHaveAttribute('href','/forgot-password')
  })
  it('submits the resolved login fields',async () => {
    vi.spyOn(api,'me').mockRejectedValue(new Error('no session'))
    const login=vi.spyOn(api,'login').mockRejectedValue(new Error('rejected'))
    render(<MemoryRouter><AuthProvider><AuthScreen/></AuthProvider></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('البريد الإلكتروني'),{target:{value:'a@example.com'}})
    fireEvent.change(screen.getByLabelText('كلمة المرور'),{target:{value:'password123'}})
    fireEvent.click(screen.getByRole('button',{name:'دخول'}))
    await waitFor(() => expect(login).toHaveBeenCalledWith('a@example.com','password123'))
    expect(await screen.findByRole('alert')).toHaveTextContent('rejected')
  })
})
