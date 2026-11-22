import { CircleHelp, Languages, LogOut, Settings2, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import { firstName, roleLabel } from '../lib/format'
import { navItems, type Section } from '../lib/nav'

interface SidebarProps { section: Section; open: boolean; onSelect: (section: Section) => void; onClose: () => void }

export function Sidebar({ section, open, onSelect, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  if (!user) return null
  const initial = firstName(user.display_name).charAt(0)

  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark"><Languages size={21} /></div>
        <div><strong>SIGNBRIDGE</strong><small>COMMUNICATION, CONNECTED</small></div>
        <button className="mobile-close icon-button" aria-label="إغلاق القائمة" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="workspace-switch">
        <div className="workspace-avatar">{initial}</div>
        <div className="workspace-label"><strong>مساحة {firstName(user.display_name)}</strong><span>حساب {roleLabel[user.role]}</span></div>
      </div>
      <div className="nav-caption">القائمة الرئيسية</div>
      <nav className="nav-list" aria-label="التنقل الرئيسي">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-link ${section === id ? 'active' : ''}`} aria-current={section === id ? 'page' : undefined} onClick={() => onSelect(id)}>
            <Icon size={19} /><span>{label}</span>{id === 'conversation' && <i className="live-dot" />}
          </button>
        ))}
      </nav>
      <div className="nav-caption tools-caption">حسابك</div>
      <nav className="nav-list" aria-label="الحساب">
        <button className={`nav-link ${section === 'settings' ? 'active' : ''}`} onClick={() => onSelect('settings')}><Settings2 size={19} /><span>الإعدادات</span></button>
        <button className="nav-link" onClick={() => onSelect('settings')}><CircleHelp size={19} /><span>الدعم وإرسال ملاحظات</span></button>
      </nav>
      <div className="sidebar-spacer" />
      <div className="privacy-mini"><div className="privacy-icon"><ShieldCheck size={17} /></div><div><strong>خصوصيتك أولاً</strong><p>الكاميرا محلية. الإملاء يخضع لمزود المتصفح.</p></div></div>
      <div className="profile">
        <div className="profile-avatar">{initial}</div>
        <div className="profile-info"><strong>{user.display_name}</strong><span>{roleLabel[user.role]}</span></div>
        <button className="icon-button profile-more" aria-label="تسجيل الخروج" title="تسجيل الخروج" onClick={logout}><LogOut size={18} /></button>
      </div>
    </aside>
  )
}
