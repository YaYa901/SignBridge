import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppData } from '../context/app-data-context'
import { useToast } from '../context/toast-context'
import { Modal } from '../components/Modal'
import { PageHeading, Spinner } from '../components/ui'
import { SignVideo } from '../components/SignVideo'
import { api } from '../lib/api'
import { errorMessage } from '../lib/errors'
import type { LessonDetail, Quiz, QuizResult, Sign } from '../lib/types'

function LessonDialog({ id, onClose }: {id: string; onClose: () => void}) {
  const {setLessonProgress}=useAppData()
  const {notify}=useToast()
  const [detail,setDetail]=useState<LessonDetail|null>(null)
  const [quiz,setQuiz]=useState<Quiz|null>(null)
  const [answers,setAnswers]=useState<Record<string,string>>({})
  const [result,setResult]=useState<QuizResult|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  useEffect(() => {
    let live=true
    api.getLesson(id).then(d => {if(live)setDetail(d)}).catch(e => {if(live)setError(errorMessage(e))})
    if (id.startsWith('dictionary-')) api.getQuiz(id).then(q => {if(live)setQuiz(q)}).catch(e => {if(live)setError(errorMessage(e))})
    return () => {live=false}
  }, [id])
  async function submit() {
    setBusy(true)
    try {const r=await api.submitQuiz(id,answers);setResult(r);await setLessonProgress(id,Math.max(detail?.progress??0,r.score));notify('تم حفظ نتيجة الاختبار والتقدم.')} catch(e) {notify(errorMessage(e))} finally {setBusy(false)}
  }
  return <Modal title={detail?.title??'تحميل الدرس'} onClose={onClose}>
    {error && <p role="alert">{error}</p>}
    {!detail?<Spinner/>:<>
      <p className="modal-note">{detail.is_sample?'قائمة مفردات نصية، بدون فيديوهات.':'فيديوهات من بيانات مصرية مرخصة. التسميات من ناشر البيانات ولم يراجعها خبير مستقل.'}</p>
      {detail.items.map(item => item.sign?<SignVideo key={item.position} sign={item.sign}/>:<p key={item.position}>{item.gloss}</p>)}
      {quiz && <section><h2>{quiz.title}</h2><p>شاهد الفيديو واختر المعنى. التقدم يساوي أفضل نسبة إجابات صحيحة.</p>{quiz.best_score!==null&&<p>أفضل نتيجة: {Math.round(quiz.best_score*100)}%</p>}
        {quiz.questions.map((q,i) => <fieldset key={q.id} className="quiz-question"><legend>سؤال {i+1}</legend><video src={q.media_url} controls playsInline muted preload="none" aria-label={`فيديو السؤال ${i+1}`}/>{q.options.map(option => <label key={option} className="quiz-option"><input type="radio" name={'q-'+q.id} value={option} checked={answers[q.id]===option} onChange={() => {setAnswers({...answers,[q.id]:option});setResult(null)}}/>{option}</label>)}{result&&<p>الإجابة الصحيحة: {result.answers[q.id]}</p>}</fieldset>)}
        <button className="primary-button" disabled={busy||Object.keys(answers).length!==quiz.questions.length} onClick={() => void submit()}>تصحيح وحفظ النتيجة</button>{result&&<p role="status">النتيجة: {result.correct} / {result.total} ({Math.round(result.score*100)}%)</p>}
      </section>}
      {detail.is_sample && <button className="outline-button" onClick={() => void setLessonProgress(id,1).then(() => notify('تم تسجيل المراجعة.')).catch(e => notify(errorMessage(e)))}>تمت مراجعة المفردات</button>}
    </>}
  </Modal>
}

export function Dictionary({savedOnly=false}: {savedOnly?: boolean}) {
  const [signs,setSigns]=useState<Sign[]>([])
  const [query,setQuery]=useState('')
  const [error,setError]=useState('')
  const {notify}=useToast()
  useEffect(() => {let live=true;api.dictionary().then(s => {if(live)setSigns(s)}).catch(e => {if(live)setError(errorMessage(e))});return () => {live=false}},[])
  async function save(sign: Sign) {
    try {await api.saveSign(sign.id,!sign.saved);setSigns(items => items.map(s => s.id===sign.id?{...s,saved:!s.saved}:s))}catch(e){notify(errorMessage(e))}
  }
  const filtered=signs.filter(s => (!savedOnly||s.saved)&&s.gloss.includes(query.trim()))
  return <section className="panel dictionary-panel"><h2>{savedOnly?'الإشارات المحفوظة':'قاموس الفيديو، 32 مدخلاً'}</h2><p>إعداد: Métwalli, Metwalli & Elshaer (2025). CC BY 4.0. تم تصغير الفيديوهات وحذف الصوت. بدون اعتماد من أصحاب البيانات.</p><label>بحث <input value={query} onChange={e => setQuery(e.target.value)} aria-label="بحث القاموس"/></label>{error&&<p role="alert">{error}</p>}<div className="dictionary-grid">{filtered.map(sign => <article key={sign.id}><SignVideo sign={sign}/><button className="outline-button" aria-pressed={!!sign.saved} onClick={() => void save(sign)}>{sign.saved?'إزالة من المحفوظات':'حفظ الإشارة'}</button></article>)}</div>{!filtered.length&&!error&&<p>لا توجد نتائج.</p>}</section>
}

export function Learn() {
  const {lessons,toggleBookmark}=useAppData()
  const {notify}=useToast()
  const [params,setParams]=useSearchParams()
  const id=params.get('lesson')
  return <><PageHeading eyebrow="تعلم عملي" title="مركز التعلم" description="دروس فيديو واختبارات ومعجم مرخص. اللغة الأساسية: الإشارة المصرية. المحتوى يحتاج مراجعة مجتمعية مستقلة."/>
    <div className="lesson-grid">{lessons.map(l => <article className="panel settings-panel" key={l.id}><h2>{l.title}</h2><p>{l.item_count} مفردات · {l.is_sample?'مراجعة نصية':'فيديو واختبار'}</p><progress value={l.progress} max={1} aria-label={`التقدم في ${l.title}`}/><p>{Math.round(l.progress*100)}%</p><button className="primary-button" onClick={() => setParams({lesson:l.id})}>فتح الدرس</button><button className="subtle-button" aria-pressed={l.bookmarked} onClick={() => void toggleBookmark(l.id).catch(e => notify(errorMessage(e)))}>{l.bookmarked?'إزالة العلامة':'حفظ الدرس'}</button></article>)}</div>
    <Dictionary/>{id&&<LessonDialog key={id} id={id} onClose={() => setParams({})}/>}
  </>
}
