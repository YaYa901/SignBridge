import { useState } from 'react'
import { ArrowLeftRight, Download, Mic, Star, Video } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import { useAppData } from '../context/app-data-context'
import { useToast } from '../context/toast-context'
import { CameraPreview } from '../components/CameraPreview'
import { EmptyState, PageHeading } from '../components/ui'
import { VideoSequence } from '../components/SignVideo'
import { useDictation } from '../hooks/useDictation'
import type { CameraApi } from '../hooks/useCamera'
import { api } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { downloadBlob, formatWhen } from '../lib/format'
import type { Translation } from '../lib/types'

export function Translate({ camera }: {camera: CameraApi}) {
  const { user, saveSettings } = useAuth()
  const { translations, addTranslation, clearTranslations, addPhrase } = useAppData()
  const { notify } = useToast()
  const dictation = useDictation()
  const [mode,setMode] = useState<'text'|'sign'>('text')
  const [input,setInput] = useState('')
  const [result,setResult] = useState<Translation|null>(null)
  const [busy,setBusy] = useState(false)
  const [feedback,setFeedback] = useState('')
  async function submit() {
    if (!input.trim()) return notify('اكتب نصاً أولاً.')
    setBusy(true)
    try { setResult(await addTranslation('text_to_sign',input)); setFeedback('') } catch(e) { notify(errorMessage(e)) } finally { setBusy(false) }
  }
  async function download() {
    setBusy(true)
    try { downloadBlob('signbridge-history.json',JSON.stringify(await api.allTranslations(),null,2),'application/json') } catch(e) { notify(errorMessage(e)) } finally { setBusy(false) }
  }
  return <>
    <PageHeading eyebrow="قاموس فيديو مصري" title="مساحة الترجمة" description="نص إلى فيديوهات إشارات حقيقية لكلمات وعبارات محددة. ليست ترجمة لغوية لجمل كاملة." />
    <div className="mode-switch" role="tablist">
      <button role="tab" aria-selected={mode==='text'} className={mode==='text'?'selected':''} onClick={() => {setMode('text');camera.stop()}}><ArrowLeftRight size={17}/> نص إلى إشارة</button>
      <button role="tab" aria-selected={mode==='sign'} className={mode==='sign'?'selected':''} onClick={() => {setMode('sign');dictation.stop()}}><Video size={17}/> إشارة إلى نص · غير متاح</button>
    </div>
    {mode==='text' ? <div className="workspace-grid">
      <section className="panel input-panel">
        <div className="panel-heading"><div><h2>اكتب عبارة</h2><p>جرّب: صباح الخير · عامل إيه · دكتور · بكرة</p></div></div>
        <div className="textarea-wrap"><textarea value={input} maxLength={500} onChange={e => setInput(e.target.value)} aria-label="النص المراد ترجمته" placeholder="صباح الخير"/></div>
        <div className="input-bottom"><span dir="ltr">{input.length} / 500</span><button className="outline-button" onClick={() => dictation.toggle(input,text => setInput(text.slice(0,500)))}><Mic size={16}/>{dictation.listening?'إيقاف الإملاء':'إملاء صوتي'}</button><button className="primary-button" onClick={() => void submit()} disabled={busy}>عرض الإشارات</button></div>
        <p className="modal-note">البحث يطابق أطول عبارة متاحة أولاً. لا نخمن الكلمات الناقصة ولا نبدل ترتيب الجملة. قد تختلف الإشارات حسب المنطقة. راجع مركز التعلم لكل المفردات.</p>
      </section>
      <section className="panel result-panel" aria-live="polite">
        <div className="panel-heading"><div><h2>فيديوهات القاموس</h2><p>32 مدخلاً من بيانات بحثية مصرية مرخصة</p></div><label>السرعة <select value={user?.settings.player_speed??1} onChange={e => void saveSettings({player_speed:Number(e.target.value)}).catch(e => notify(errorMessage(e)))}><option value={0.7}>0.7×</option><option value={1}>1×</option><option value={1.3}>1.3×</option></select></label></div>
        {result ? <>
          {!!result.unknown?.length && <p className="coverage-warning" role="status">غير متاح في القاموس: {result.unknown.join('، ')}. الفيديوهات لا تغطي النص كله.</p>}
          {result.clips?.length ? <VideoSequence key={result.id} clips={result.clips} speed={user?.settings.player_speed??1}/> : <EmptyState text="لم نجد إشارات لهذه الكلمات. لم يتم إنتاج ترجمة."/>}
          <p className="modal-note">{result.message}</p>
          <div className="result-actions"><button className="subtle-button" onClick={() => void addPhrase(result.input_text??'').then(() => notify('تم حفظ العبارة.')).catch(e => notify(errorMessage(e)))}><Star size={16}/> حفظ العبارة</button></div>
          <form className="setting-form" onSubmit={e => {e.preventDefault();void api.sendFeedback(feedback,result.id).then(() => {setFeedback('');notify('وصلت ملاحظتك مرتبطة بالترجمة.')}).catch(e => notify(errorMessage(e)))}}><label htmlFor="translation-feedback">ملاحظة على هذه النتيجة</label><input id="translation-feedback" value={feedback} maxLength={2000} onChange={e => setFeedback(e.target.value)}/><button className="outline-button" disabled={feedback.trim().length<2}>إرسال الملاحظة</button></form>
        </> : <EmptyState text="اكتب كلمة من القاموس لعرض فيديو الإشارة."/>}
      </section>
    </div> : <section className="panel settings-panel">
      <h2>التعرف الآلي بالكاميرا غير متاح</h2><p>لا يوجد نموذج تم تقييمه على مستخدمين مصريين مستقلين. لن نعرض نصاً تخمينياً أو نعتبر النص اليدوي ترجمة.</p>
      <button className="outline-button" onClick={() => void camera.toggle()}>{camera.on?'إيقاف الكاميرا':'معاينة محلية فقط'}</button>
      {camera.on && <div className="camera-view"><CameraPreview stream={camera.stream} label="معاينة محلية، بدون تعرف أو تسجيل"/></div>}
    </section>}
    <section className="panel history-panel"><div className="panel-heading"><div><h2>السجل الحديث</h2><p>آخر 30 طلباً. التنزيل يشمل كل السجل مع النتائج والكلمات الناقصة.</p></div><button className="subtle-button" disabled={busy} onClick={() => void download()}><Download size={16}/> تنزيل الكل</button><button className="subtle-button" onClick={() => {if(window.confirm('حذف كل السجل؟'))void clearTranslations().then(() => setResult(null)).catch(e => notify(errorMessage(e)))}}>مسح الكل</button></div>
      {translations.map(t => <div className="history-table-row" key={t.id}><button className="subtle-button" onClick={() => {setInput(t.input_text??'');setResult(t);setMode('text');camera.stop()}}>{t.input_text}</button><span>{t.output_text??'بلا نتيجة'}</span><time>{formatWhen(t.created_at)}</time><span>{t.status==='partial'?'تغطية جزئية':t.status==='dictionary_match'?'مطابقة قاموس':'غير متاح'}</span></div>)}
    </section>
  </>
}
