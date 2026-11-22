import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowLeftRight, History, LockKeyhole, Mic, MicOff, ShieldCheck, Video, VideoOff } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import { useAppData } from '../context/app-data-context'
import { useToast } from '../context/toast-context'
import { CameraPreview } from '../components/CameraPreview'
import { EmptyState, PageHeading } from '../components/ui'
import { useDictation } from '../hooks/useDictation'
import type { CameraApi } from '../hooks/useCamera'
import { errorMessage } from '../lib/errors'
import { formatTime } from '../lib/format'
import type { MessageSource, Speaker } from '../lib/types'

const MAX_LENGTH = 1000

export function Conversation({ camera }: { camera: CameraApi }) {
  const { user } = useAuth()
  const { conversation, sendMessage, resetConversation } = useAppData()
  const { notify } = useToast()
  const dictation = useDictation()
  const [draft, setDraft] = useState('')
  const [speaker, setSpeaker] = useState<Speaker>('me')
  const [dictated, setDictated] = useState(false)
  const [busy, setBusy] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const messages = conversation?.messages ?? []

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
  }, [messages.length])

  const startDictation = () => dictation.toggle(draft, text => { setDictated(true); setDraft(text.slice(0, MAX_LENGTH)) })

  async function send() {
    const text = draft.trim()
    if (!text) { notify('اكتب رسالة قبل الإرسال.'); return }
    const source: MessageSource = dictated ? 'dictation' : 'typed'
    setBusy(true)
    dictation.stop()
    setDraft('')
    setDictated(false)
    try {
      await sendMessage(text, speaker, source)
    } catch (e) {
      setDraft(current => current || text) // give the text back if sending failed
      notify(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function newSession() {
    if (messages.length && !window.confirm('بدء جلسة جديدة؟ ستبقى الجلسة الحالية محفوظة في حسابك.')) return
    try { await resetConversation(); setDraft(''); notify('بدأت جلسة جديدة.') } catch (e) { notify(errorMessage(e)) }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() }
  }

  const label = (speakerLabel: Speaker, source: MessageSource) =>
    `${speakerLabel === 'me' ? user?.display_name ?? 'أنا' : 'الطرف الآخر'} · ${source === 'dictation' ? 'إملاء' : 'كتابة'}`

  return (
    <>
      <PageHeading eyebrow="تواصل متبادل" title="محادثة مباشرة" description="مساحة مشتركة على جهاز واحد للكتابة والاستماع. لا يوجد بث أو ترجمة إشارة تلقائية." />
      <div className="conversation-warning"><ShieldCheck size={18} /><span><strong>الكاميرا محلية والإملاء اختياري</strong>. لا نسجل الوسائط. خدمة المتصفح قد ترسل الصوت إلى مزودها. النصوص المرسلة تحفظ في حسابك.</span></div>
      <div className="conversation-grid">
        <section className="panel conversation-media">
          <div className="panel-heading">
            <div><h2>معاينة الكاميرا</h2><p>اختيارية — محلية فقط</p></div>
            <span className={`connection-label ${camera.on ? 'connected' : ''}`}><i /> {camera.on ? 'نشطة' : 'متوقفة'}</span>
          </div>
          <div className="camera-view conversation-camera">
            {camera.on ? <CameraPreview stream={camera.stream} label="معاينة الكاميرا المحلية" /> : (
              <div className="camera-placeholder"><div className="camera-illustration"><Video size={29} /></div><strong>ابدأ عندما تكون مستعداً</strong><span>يحتاج المتصفح إلى إذن صريح.</span></div>
            )}
          </div>
          <div className="media-actions">
            <button className={camera.on ? 'secondary-button' : 'primary-button'} onClick={() => void camera.toggle()}>{camera.on ? <><VideoOff size={16} /> إيقاف الكاميرا</> : <><Video size={16} /> تشغيل الكاميرا</>}</button>
            <button className={`secondary-button ${dictation.listening ? 'mic-active' : ''}`} onClick={startDictation} aria-pressed={dictation.listening}>{dictation.listening ? <MicOff size={16} /> : <Mic size={16} />} {dictation.listening ? 'إيقاف الميكروفون' : 'بدء الإملاء'}</button>
          </div>
        </section>

        <section className="panel transcript-panel">
          <div className="panel-heading">
            <div><h2>لوحة المحادثة</h2><p>اكتب أو أملِ الرسالة</p></div>
            <button className="subtle-button" onClick={() => void newSession()}><History size={15} /> جلسة جديدة</button>
          </div>
          <div className="message-feed" ref={feedRef} aria-live="polite">
            {messages.map(message => (
              <div className={`message-bubble ${message.speaker_label === 'me' ? 'message-own' : ''}`} key={message.id}>
                <div><span className="speaker-label">{label(message.speaker_label, message.source)}</span><time dateTime={message.created_at}>{formatTime(message.created_at)}</time></div>
                <p>{message.text}</p>
              </div>
            ))}
            {messages.length === 0 && <EmptyState text="لا توجد رسائل في هذه الجلسة بعد." />}
          </div>
          <div className="speaker-switch" role="group" aria-label="المتحدث">
            <button className={speaker === 'me' ? 'filter-active' : ''} aria-pressed={speaker === 'me'} onClick={() => setSpeaker('me')}>أنا</button>
            <button className={speaker === 'other' ? 'filter-active' : ''} aria-pressed={speaker === 'other'} onClick={() => setSpeaker('other')}>الطرف الآخر</button>
          </div>
          <div className="composer">
            <textarea value={draft} maxLength={MAX_LENGTH} onChange={e => { setDraft(e.target.value); setDictated(false) }} onKeyDown={onKeyDown} placeholder="اكتب رسالة…" aria-label="رسالة المحادثة" />
            <button className="mic-compose" aria-label="إملاء صوتي" onClick={startDictation}><Mic size={17} /></button>
            <button className="primary-button send-button" disabled={busy} onClick={() => void send()}>إرسال <ArrowLeftRight size={15} /></button>
          </div>
          <p className="composer-note"><LockKeyhole size={12} /> Enter للإرسال · Shift+Enter لسطر جديد.</p>
        </section>
      </div>
    </>
  )
}
