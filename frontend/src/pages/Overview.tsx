import { Activity, ArrowLeftRight, ArrowUpRight, AudioLines, BookOpen, Clock3, Copy, FileText, GraduationCap, Plus, Sparkles, Star } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import { useAppData } from '../context/app-data-context'
import { useToast } from '../context/toast-context'
import { copyToClipboard } from '../lib/browser'
import { arNumber, directionLabel, firstName, formatWhen } from '../lib/format'
import type { Section } from '../lib/nav'
import { EmptyState, QuickCard, StatCard } from '../components/ui'

export function Overview({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { user } = useAuth()
  const { translations, phrases, lessons } = useAppData()
  const { notify } = useToast()

  const completed = lessons.filter(lesson => lesson.progress >= 1)
  const started = lessons.filter(lesson => lesson.progress > 0)
  const bookmarked = lessons.filter(lesson => lesson.bookmarked).length
  const reviewedWords = completed.reduce((sum, lesson) => sum + lesson.item_count, 0)

  async function copy(text: string) {
    notify((await copyToClipboard(text)) ? 'تم النسخ إلى الحافظة.' : 'تعذّر النسخ؛ حدّد النص وانسخه يدوياً.')
  }

  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> مساحتك الشخصية</div>
          <h1>أهلاً {user ? firstName(user.display_name) : ''}، <span>نوّرتنا!</span></h1>
          <p className="welcome-sub">مساحة واحدة للتواصل والتعلّم، على طريقتك.</p>
        </div>
        <button className="primary-button" onClick={() => onNavigate('translate')}><Plus size={18} /> ترجمة جديدة</button>
      </div>

      <div className="notice-banner">
        <div className="notice-icon"><Sparkles size={17} /></div>
        <div><strong>قاموس فيديو مصري متاح الآن</strong><span>اعرض إشارات كلمات محددة مع توضيح الناقص. التعرف بالكاميرا وترجمة قواعد الجمل غير متاحين.</span></div>
        <button onClick={() => onNavigate('translate')}>مساحة الترجمة <ArrowLeftRight size={15} /></button>
      </div>

      <div className="stats-grid">
        <StatCard label="طلبات الترجمة" value={translations.length >= 30 ? `${arNumber(30)}+` : arNumber(translations.length)} note="محفوظة في حسابك" icon={<ArrowLeftRight size={19} />} tint="blue-tint" />
        <StatCard label="عبارات محفوظة" value={arNumber(phrases.length)} note="في قائمتك الشخصية" icon={<Star size={19} />} tint="mint-tint" />
        <StatCard label="دروس مكتملة" value={arNumber(completed.length)} note={completed.length ? `${arNumber(reviewedWords)} مفردة تمت مراجعتها` : 'ابدأ أول درس اليوم'} icon={<GraduationCap size={20} />} tint="lilac-tint" />
        <StatCard label="دروس مفضّلة" value={arNumber(bookmarked)} note="للرجوع إليها بسرعة" icon={<Clock3 size={19} />} tint="sand-tint" />
      </div>

      <div className="dashboard-grid">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div><h2>النشاط الأخير</h2><p>طلبات الترجمة في حسابك</p></div>
            <button className="text-button" onClick={() => onNavigate('translate')}>مساحة الترجمة <ArrowLeftRight size={14} /></button>
          </div>
          <div className="activity-list">
            {translations.slice(0, 4).map(item => (
              <div className="activity-row" key={item.id}>
                <div className="activity-symbol"><FileText size={18} /></div>
                <div className="activity-text"><strong>{item.input_text}</strong><span>{directionLabel(item.direction)}</span></div>
                <time dateTime={item.created_at}>{formatWhen(item.created_at)}</time>
                <button className="icon-button row-more" aria-label="نسخ العبارة" onClick={() => void copy(item.input_text ?? '')}><Copy size={16} /></button>
              </div>
            ))}
          </div>
          {translations.length === 0 && <EmptyState text="لا يوجد نشاط حتى الآن. جرّب كتابة عبارة في مساحة الترجمة." />}
        </section>

        <section className="panel progress-panel">
          <div className="panel-heading">
            <div><h2>رحلتك في التعلّم</h2><p>تقدّمك المحفوظ في حسابك</p></div>
            <div className="progress-badge"><Activity size={15} /></div>
          </div>
          {started.length ? (
            <div className="progress-list">
              {started.map(lesson => (
                <div className="progress-row" key={lesson.id}>
                  <span>{lesson.title}</span>
                  <div className="bar" role="progressbar" aria-valuenow={Math.round(lesson.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={lesson.title}><i style={{ width: `${Math.round(lesson.progress * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="progress-empty">
              <div className="progress-orbit"><BookOpen size={28} /></div>
              <strong>كل بداية صغيرة بتفرق</strong>
              <p>درس قصير يكفي للبداية.</p>
              <button className="outline-button" onClick={() => onNavigate('learn')}>استكشاف الدروس <ArrowUpRight size={15} /></button>
            </div>
          )}
          <div className="progress-footer"><span>اللغة الأساسية</span><strong><span className="language-dot" /> لغة الإشارة المصرية <small>ESL</small></strong></div>
        </section>
      </div>

      <div className="section-title-row"><div><h2>ابدأ من هنا</h2><p>أدوات يومية تخلّي التواصل أسهل</p></div></div>
      <div className="quick-grid">
        <QuickCard icon={<ArrowLeftRight size={20} />} title="مساحة الترجمة" text="كتابة عبارة أو تجربة أدوات الجهاز." action="البدء الآن" onClick={() => onNavigate('translate')} tone="quick-blue" />
        <QuickCard icon={<AudioLines size={20} />} title="محادثة مباشرة" text="مساحة مشتركة لتبادل الرسائل." action="فتح المحادثة" onClick={() => onNavigate('conversation')} tone="quick-mint" />
        <QuickCard icon={<BookOpen size={20} />} title="مركز التعلّم" text="فيديوهات إشارات واختبارات للمفردات." action="استكشاف الدروس" onClick={() => onNavigate('learn')} tone="quick-lavender" />
      </div>
    </>
  )
}
