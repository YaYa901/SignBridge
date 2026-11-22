import { EmailNotice } from './EmailNotice'
import { Link } from 'react-router-dom'
import { useState, type FormEvent } from 'react'
import { Languages, LockKeyhole, ShieldCheck, Video } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import { errorMessage } from '../lib/errors'

type Mode = 'login' | 'register'
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function AuthScreen() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (mode === 'register' && !name.trim()) return setError('اكتب اسمك أولاً.')
    if (!EMAIL_RE.test(email.trim())) return setError('البريد الإلكتروني غير صالح.')
    if (mode === 'register' && password.length < 8) return setError('كلمة المرور يجب ألا تقل عن ٨ أحرف.')
    if (!password) return setError('اكتب كلمة المرور.')
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await login(email.trim(), password)
      else await register(email.trim(), password, name.trim())
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const switchMode = (next: Mode) => { setMode(next); setError('') }

  return (
    <div className="auth-shell" dir="rtl">
      <section className="auth-side">
        <div className="brand"><div className="brand-mark"><Languages size={21} /></div><div><strong>SIGNBRIDGE</strong><small>COMMUNICATION, CONNECTED</small></div></div>
        <h1>تواصل وتعلّم، بخصوصية أولاً.</h1>
        <p>مساحة عربية لتجهيز العبارات وتتبّع تعلّمك ومحادثاتك، مصمَّمة حول لغة الإشارة المصرية.</p>
        <ul className="auth-points">
          <li><ShieldCheck size={17} /> بياناتك مرتبطة بحسابك ويمكنك تصديرها أو حذفها في أي وقت.</li>
          <li><Video size={17} /> الكاميرا للمعاينة المحلية فقط. الإملاء الصوتي يخضع لخدمة المتصفح وقد يرسل الصوت لمزوده.</li>
          <li><LockKeyhole size={17} /> قاموس فيديو لكلمات مصرية محددة. لا نخمن الإشارات ولا ندعي التعرف بالكاميرا.</li>
        </ul>
      </section>

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="mode-switch" role="tablist">
          <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'selected' : ''} onClick={() => switchMode('login')}>تسجيل الدخول</button>
          <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'selected' : ''} onClick={() => switchMode('register')}>حساب جديد</button>
        </div>
        <EmailNotice />
        <p><Link to="/forgot-password">نسيت كلمة المرور؟</Link></p>
        <p><Link to="/privacy">الخصوصية وحدود الخدمة</Link></p>
        <h2 id="auth-title">{mode === 'login' ? 'أهلاً بعودتك' : 'إنشاء حساب'}</h2>
        <form className="form-stack" onSubmit={submit} noValidate>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="auth-name">الاسم</label>
              <input id="auth-name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={80} />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">البريد الإلكتروني</label>
            <input id="auth-email" type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
          </div>
          <div className="field">
            <label htmlFor="auth-password">كلمة المرور</label>
            <input id="auth-password" type="password" dir="ltr" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} maxLength={128} />
            {mode === 'register' && <small>٨ أحرف على الأقل.</small>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button wide" type="submit" disabled={busy}>{busy ? 'جارٍ المعالجة…' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}</button>
        </form>
      </section>
    </div>
  )
}
