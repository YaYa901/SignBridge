import { Dictionary } from './Learn'
import { useState, type FormEvent } from 'react'
import { BookOpen, Copy, Plus, Search, Star, X } from 'lucide-react'
import { useAppData } from '../context/app-data-context'
import { useToast } from '../context/toast-context'
import { EmptyState, PageHeading } from '../components/ui'
import { copyToClipboard } from '../lib/browser'
import { errorMessage } from '../lib/errors'
import { formatWhen } from '../lib/format'

export function Saved() {
  const { phrases, lessons, addPhrase, removePhrase, toggleBookmark } = useAppData()
  const { notify } = useToast()
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')

  const q = query.trim()
  const shownPhrases = phrases.filter(p => p.text.includes(q))
  const shownLessons = lessons.filter(l => l.bookmarked && l.title.includes(q))

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim()) { notify('اكتب العبارة أولاً.'); return }
    try { await addPhrase(draft); setDraft(''); notify('أُضيفت العبارة إلى قائمتك.') } catch (e) { notify(errorMessage(e)) }
  }

  async function copy(text: string) {
    notify((await copyToClipboard(text)) ? 'تم النسخ إلى الحافظة.' : 'تعذّر النسخ؛ حدّد النص وانسخه يدوياً.')
  }

  return (
    <>
      <PageHeading eyebrow="مكتبتك الشخصية" title="إشاراتي المحفوظة" description="العبارات والدروس المفضّلة، محفوظة في حسابك." />
      <Dictionary savedOnly />
      <div className="saved-toolbar">
        <div className="search-field"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث في المحفوظات…" aria-label="بحث المحفوظات" /></div>
        <form className="add-phrase" onSubmit={e => void add(e)}>
          <input value={draft} maxLength={500} onChange={e => setDraft(e.target.value)} placeholder="عبارة جديدة…" aria-label="عبارة جديدة" />
          <button className="outline-button" type="submit"><Plus size={16} /> إضافة</button>
        </form>
      </div>
      <div className="saved-list">
        {shownPhrases.map(phrase => (
          <div className="saved-row" key={phrase.id}>
            <div className="saved-icon"><Star size={17} /></div>
            <strong>{phrase.text}</strong>
            <span>{formatWhen(phrase.created_at)}</span>
            <button className="icon-button" aria-label={`نسخ ${phrase.text}`} onClick={() => void copy(phrase.text)}><Copy size={16} /></button>
            <button className="icon-button remove-save" aria-label={`حذف ${phrase.text}`} onClick={() => void removePhrase(phrase.id).catch(e => notify(errorMessage(e)))}><X size={16} /></button>
          </div>
        ))}
        {shownLessons.map(lesson => (
          <div className="saved-row" key={lesson.id}>
            <div className="saved-icon lesson-icon"><BookOpen size={17} /></div>
            <strong>{lesson.title}</strong>
            <span>درس مفضّل</span>
            <button className="icon-button remove-save" aria-label={`إزالة ${lesson.title} من المفضّلة`} onClick={() => void toggleBookmark(lesson.id).catch(e => notify(errorMessage(e)))}><X size={16} /></button>
          </div>
        ))}
        {shownPhrases.length + shownLessons.length === 0 && <EmptyState text={q ? 'ما فيش محفوظات تطابق بحثك.' : 'لا توجد عناصر محفوظة بعد.'} />}
      </div>
    </>
  )
}
