import { EmailNotice } from '../components/EmailNotice'
import { useEffect, useState, type FormEvent } from 'react'
import { Check, Download, Globe2, LockKeyhole, ShieldCheck, Languages, UserRound } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import { useAppData } from '../context/app-data-context'
import { useToast } from '../context/toast-context'
import { Modal } from '../components/Modal'
import { PageHeading } from '../components/ui'
import { api } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { arNumber, downloadBlob, roleLabel } from '../lib/format'
import type { AdminStats, Feedback } from '../lib/types'

const SPEEDS = [0.7, 1, 1.3]
const speedLabel = (v: number) => `${v.toLocaleString('ar-EG')}×`

function ProfileForm() {
  const { user, setUser } = useAuth()
  const { notify } = useToast()
  const [name, setName] = useState(user?.display_name ?? '')
  const [busy, setBusy] = useState(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) { notify('الاسم مطلوب.'); return }
    setBusy(true)
    try { setUser(await api.updateName(name.trim())); notify('تم تحديث الاسم.') } catch (e) { notify(errorMessage(e)) } finally { setBusy(false) }
  }
  return (
    <form className="setting-form" onSubmit={e => void save(e)}>
      <div className="field"><label htmlFor="set-name">الاسم المعروض</label><input id="set-name" value={name} maxLength={80} onChange={e => setName(e.target.value)} /></div>
      <button className="outline-button" type="submit" disabled={busy || name.trim() === user?.display_name}>حفظ الاسم</button>
    </form>
  )
}

function PasswordForm() {
  const { applyAuth } = useAuth()
  const { notify } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (next.length < 8) { notify('كلمة المرور الجديدة يجب ألا تقل عن ٨ أحرف.'); return }
    setBusy(true)
    try {
      const result = await api.changePassword(current, next)
      applyAuth(result.user)
      setCurrent(''); setNext('')
      notify('تم تغيير كلمة المرور. تم إنهاء الجلسات الأخرى.')
    } catch (e) { notify(errorMessage(e)) } finally { setBusy(false) }
  }
  return (
    <form className="setting-form" onSubmit={e => void save(e)}>
      <div className="field"><label htmlFor="pw-current">كلمة المرور الحالية</label><input id="pw-current" type="password" dir="ltr" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} /></div>
      <div className="field"><label htmlFor="pw-new">كلمة المرور الجديدة</label><input id="pw-new" type="password" dir="ltr" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} /></div>
      <button className="outline-button" type="submit" disabled={busy || !current || !next}>تغيير كلمة المرور</button>
    </form>
  )
}

function FeedbackForm() {
  const { notify } = useToast()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function send(event: FormEvent) {
    event.preventDefault()
    if (message.trim().length < 2) { notify('اكتب ملاحظتك أولاً.'); return }
    setBusy(true)
    try { await api.sendFeedback(message.trim()); setMessage(''); notify('شكراً لك! وصلتنا ملاحظتك.') } catch (e) { notify(errorMessage(e)) } finally { setBusy(false) }
  }
  return (
    <form className="setting-form" onSubmit={e => void send(e)}>
      <div className="field"><label htmlFor="fb">ملاحظة أو مشكلة</label><textarea id="fb" rows={4} maxLength={2000} value={message} onChange={e => setMessage(e.target.value)} placeholder="اكتب ما تودّ إخبارنا به…" /></div>
      <button className="primary-button" type="submit" disabled={busy}>إرسال</button>
    </form>
  )
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth()
  const { notify } = useToast()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  async function confirm(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try { await api.deleteAccount(password); notify('تم حذف حسابك وجميع بياناتك.'); logout() } catch (e) { notify(errorMessage(e)); setBusy(false) }
  }
  return (
    <Modal title="حذف الحساب نهائياً" onClose={onClose}>
      <p className="modal-note">سيُحذف حسابك مع الترجمات والعبارات المحفوظة والمحادثات والتقدّم والملاحظات. لا يمكن التراجع. اكتب كلمة المرور للتأكيد.</p>
      <form className="form-stack" onSubmit={e => void confirm(e)}>
        <div className="field"><label htmlFor="del-pw">كلمة المرور</label><input id="del-pw" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div className="modal-actions">
          <button className="danger-button" type="submit" disabled={busy || !password}>حذف الحساب</button>
          <button className="outline-button" type="button" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </Modal>
  )
}

function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [feedback,setFeedback]=useState<Feedback[]>([])
  const [offset,setOffset]=useState(0)
  const [error,setError]=useState('')
  useEffect(() => {let live=true;api.adminFeedback(offset).then(rows => {if(live)setFeedback(rows)}).catch(e => {if(live)setError(errorMessage(e))});return () => {live=false}},[offset])
  useEffect(() => {
    let cancelled = false
    api.adminStats().then(s => { if (!cancelled) setStats(s) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  if (!stats) return null
  return (
    <section className="panel settings-panel">
      <div className="panel-heading"><div><h2>لوحة المسؤول</h2><p>إحصاءات عامة (بدون محتوى المستخدمين)</p></div></div>
      <dl className="admin-stats">
        <div><dt>المستخدمون</dt><dd>{arNumber(stats.users)}</dd></div>
        <div><dt>طلبات الترجمة</dt><dd>{arNumber(stats.translations)}</dd></div>
        <div><dt>العبارات المحفوظة</dt><dd>{arNumber(stats.saved_phrases)}</dd></div>
        <div><dt>رسائل المحادثة</dt><dd>{arNumber(stats.conversation_messages)}</dd></div>
        <div><dt>الملاحظات</dt><dd>{arNumber(stats.feedback)}</dd></div>
      </dl>
      <h3>ملاحظات المستخدمين</h3><p>تحتوي على ما اختار المستخدمون إرساله للدعم فقط.</p>
      {error&&<p role="alert">{error}</p>}
      {feedback.map(f => <article className="feedback-row" key={f.id}><p>{f.message}</p><small>{f.created_at} · طلب الترجمة: {f.translation_id??'بدون ربط'}</small></article>)}
      <button className="outline-button" disabled={offset===0} onClick={() => setOffset(Math.max(0,offset-50))}>السابق</button>
      <button className="outline-button" disabled={feedback.length<50} onClick={() => setOffset(offset+50)}>التالي</button>
    </section>
  )
}

export function Settings() {
  const { user, saveSettings } = useAuth()
  const { translations, phrases, clearTranslations, clearPhrases } = useAppData()
  const { notify } = useToast()
  const [deleting, setDeleting] = useState(false)
  if (!user) return null

  const run = (action: () => Promise<unknown>, done: string) => action().then(() => notify(done)).catch(e => notify(errorMessage(e)))
  const setting = (patch: Parameters<typeof saveSettings>[0]) => saveSettings(patch).catch(e => notify(errorMessage(e)))

  async function exportData() {
    try {
      downloadBlob('signbridge-data.json', JSON.stringify(await api.exportData(), null, 2), 'application/json')
      notify('تم تنزيل نسخة من بياناتك.')
    } catch (e) { notify(errorMessage(e)) }
  }

  return (
    <>
      <PageHeading eyebrow="تحكّم بتجربتك" title="الإعدادات والخصوصية" description="إدارة حسابك وتفضيلاتك وبياناتك." />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="panel-heading"><div><h2>الحساب</h2><p>بيانات الدخول والملف الشخصي</p></div><UserRound size={19} /></div>
          <div className="setting-row"><div><strong>البريد الإلكتروني</strong><span dir="ltr">{user.email}</span></div><span className="setting-status">{roleLabel[user.role]}</span></div>
          <div className="setting-row"><div><strong>تأكيد البريد</strong><span>{user.email_verified?'البريد مؤكد':'البريد غير مؤكد.'}</span></div>{!user.email_verified&&<button className="outline-button" onClick={() => void api.requestEmail(user.email,'verify').then(r => notify(r.message)).catch(e => notify(errorMessage(e)))}>إعادة إرسال التأكيد</button>}</div>
          <EmailNotice />
          <ProfileForm />
          <PasswordForm />
        </section>

        <div className="settings-column">
          <section className="panel settings-panel">
            <div className="panel-heading"><div><h2>اللغة والتفضيلات</h2><p>تُحفظ في حسابك</p></div><Globe2 size={19} /></div>
            <div className="setting-row"><div><strong>لغة الواجهة</strong><span>العربية فقط في هذا الإصدار</span></div><span className="setting-status"><Check size={14} /> العربية · RTL</span></div>
            <div className="setting-row"><div><strong>سرعة فيديو القاموس</strong><span>تُستخدم في مساحة الترجمة</span></div>
              <select aria-label="سرعة العارض" value={user.settings.player_speed} onChange={e => void setting({ player_speed: Number(e.target.value) })}>{SPEEDS.map(v => <option key={v} value={v}>{speedLabel(v)}</option>)}</select></div>
            <div className="setting-row"><div><strong>سرعة القراءة الصوتية</strong><span>لقراءة النص بصوت عالٍ</span></div>
              <select aria-label="سرعة القراءة" value={user.settings.speech_rate} onChange={e => void setting({ speech_rate: Number(e.target.value) })}>{SPEEDS.map(v => <option key={v} value={v}>{speedLabel(v)}</option>)}</select></div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-heading"><div><h2>بياناتك</h2><p>تحكّم في سجلّك ومحتواك</p></div><ShieldCheck size={19} /></div>
            <div className="setting-row"><div><strong>سجل الترجمات</strong><span>{arNumber(translations.length)} عنصر</span></div><button className="subtle-button danger-subtle" disabled={!translations.length} onClick={() => { if (window.confirm('حذف سجل الترجمات نهائياً؟')) void run(clearTranslations, 'تم حذف سجل الترجمات.') }}>حذف السجل</button></div>
            <div className="setting-row"><div><strong>العبارات المحفوظة</strong><span>{arNumber(phrases.length)} عبارة</span></div><button className="subtle-button danger-subtle" disabled={!phrases.length} onClick={() => { if (window.confirm('حذف كل العبارات المحفوظة؟')) void run(clearPhrases, 'تم حذف العبارات المحفوظة.') }}>حذف المحفوظات</button></div>
            <div className="setting-row"><div><strong>الوسائط</strong><span>لا تُخزّن تسجيلات الكاميرا أو الميكروفون</span></div><span className="setting-status"><LockKeyhole size={14} /> خاصة</span></div>
            <div className="setting-row"><div><strong>نسخة من بياناتك</strong><span>ملف JSON بكل ما نحتفظ به عنك</span></div><button className="subtle-button" onClick={() => void exportData()}><Download size={15} /> تنزيل</button></div>
            <div className="setting-row"><div><strong>حذف الحساب</strong><span>إزالة الحساب وكل بياناته نهائياً</span></div><button className="danger-button" onClick={() => setDeleting(true)}>حذف الحساب</button></div>
          </section>
        </div>

        <section className="panel settings-panel">
          <div className="panel-heading"><div><h2>الدعم وإرسال ملاحظات</h2><p>ساعدنا على التحسين</p></div></div>
          <FeedbackForm />
        </section>
        {user.role === 'admin' && <AdminPanel />}
      </div>

      <section className="panel about-panel">
        <div className="about-icon"><Languages size={21} /></div>
        <div><strong>SIGNBRIDGE · الإصدار ٢٫٠</strong><p>قاموس فيديو مصري لكلمات منفصلة، وليس ترجمة قواعد الجمل. التعرف بالكاميرا غير متاح. لا يغني عن مترجم مؤهل.</p></div>
      </section>
      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
    </>
  )
}
