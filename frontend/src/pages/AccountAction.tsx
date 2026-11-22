import { EmailNotice } from '../components/EmailNotice'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { api } from '../lib/api'
import { errorMessage } from '../lib/errors'

export function ForgotPassword() {
  const [email,setEmail]=useState('')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault();setBusy(true)
    try {setMessage((await api.requestEmail(email,'reset')).message)} catch(e) {setMessage(errorMessage(e))} finally {setBusy(false)}
  }
  return <div className="public-page" dir="rtl"><h1>استعادة كلمة المرور</h1><form className="form-stack" onSubmit={e => void submit(e)}><label htmlFor="reset-email">البريد الإلكتروني</label><input id="reset-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}/><button className="primary-button" disabled={busy}>إرسال رابط الاستعادة</button></form><p role="status">{message}</p><p>مدة صلاحية رابط الاستعادة 30 دقيقة.</p><EmailNotice /><Link to="/">العودة لتسجيل الدخول</Link></div>
}

export function AccountAction() {
  const {status,setUser}=useAuth()
  const [params]=useSearchParams()
  const navigate=useNavigate()
  const [token]=useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token')??params.get('token')??'')
  const purpose=params.get('purpose')==='reset'?'reset':'verify'
  const [password,setPassword]=useState('')
  const [message,setMessage]=useState('')
  const [done,setDone]=useState(false)
  const [busy,setBusy]=useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault();setBusy(true)
    try {
      const response=await api.completeEmail(token,purpose,password)
      setMessage(response.message);setDone(true)
      navigate('/account-action?purpose='+purpose,{replace:true})
      if (purpose==='verify'&&status==='authenticated') setUser(await api.me())
    } catch(e) {setMessage(errorMessage(e))} finally {setBusy(false)}
  }
  return <div className="public-page" dir="rtl"><h1>{purpose==='reset'?'تعيين كلمة مرور جديدة':'تأكيد البريد الإلكتروني'}</h1>{!done && <form className="form-stack" onSubmit={e => void submit(e)}>{purpose==='reset' && <><label htmlFor="new-password">كلمة المرور الجديدة، 8 أحرف على الأقل</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)}/></>}<button className="primary-button" disabled={busy||!token}>تأكيد</button></form>}<p role="status">{message}</p><Link to="/">العودة للمنصة</Link></div>
}
