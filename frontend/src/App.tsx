import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Privacy } from './pages/Privacy'
import { AccountAction, ForgotPassword } from './pages/AccountAction'
import { useCallback, useEffect, useState } from 'react'
import { Globe2, Menu } from 'lucide-react'
import './App.css'
import { AuthProvider } from './context/AuthProvider'
import { ToastProvider } from './context/ToastProvider'
import { AppDataProvider } from './context/AppDataProvider'
import { useAuth } from './context/auth-context'
import { useAppData } from './context/app-data-context'
import { useToast } from './context/toast-context'
import { AuthScreen } from './components/AuthScreen'
import { Sidebar } from './components/Sidebar'
import { EmptyState, Spinner } from './components/ui'
import { useCamera } from './hooks/useCamera'
import { sectionLabel, type Section } from './lib/nav'
import { Conversation } from './pages/Conversation'
import { Learn } from './pages/Learn'
import { Overview } from './pages/Overview'
import { Saved } from './pages/Saved'
import { Settings } from './pages/Settings'
import { Translate } from './pages/Translate'

function Shell() {
  const { loading, error, retry } = useAppData()
  const { notify } = useToast()
  const camera = useCamera()
  const location = useLocation()
  const navigate = useNavigate()
  const candidate = location.pathname.split('/')[1] || 'overview'
  const valid = ['overview','translate','conversation','learn','saved','settings'].includes(candidate)
  const section = (valid ? candidate : 'overview') as Section
  const [mobileOpen, setMobileOpen] = useState(false)
  const stopCamera = camera.stop
  useEffect(() => {
    if (section !== 'translate' && section !== 'conversation') stopCamera()
  }, [section, stopCamera])

  const openSection = useCallback((next: Section) => {
    navigate('/'+next)
    setMobileOpen(false)
    // The camera preview only exists on these two screens; never leave it running elsewhere.
    if (next !== 'translate' && next !== 'conversation') stopCamera()
  }, [stopCamera, navigate])

  const about = () => notify('SIGNBRIDGE: قاموس فيديو مصري لكلمات منفصلة. التعرف بالكاميرا وترجمة قواعد الجمل غير متاحين. لا يغني عن مترجم مؤهل.')

  return (
    <div className="app-shell" dir="rtl">
      <Sidebar section={section} open={mobileOpen} onSelect={openSection} onClose={() => setMobileOpen(false)} />
      {mobileOpen && <button className="mobile-scrim" aria-label="إغلاق القائمة" onClick={() => setMobileOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-start">
            <button className="icon-button mobile-menu" aria-label="فتح القائمة" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
            <span className="breadcrumb">مساحة العمل <span>/</span> {sectionLabel(section)}</span>
          </div>
          <div className="topbar-actions">
            <span className="language-chip"><Globe2 size={15} /> العربية</span>
            <span className="topbar-divider" />
            <button className="help-link" onClick={about}>كيف يعمل؟</button>
          </div>
        </header>
        <div className="page-content">
          {!valid ? <p>الصفحة غير موجودة. <Link to="/overview">العودة للرئيسية</Link></p> : loading ? <Spinner /> : error ? (
            <div className="load-error">
              <EmptyState text={error} />
              <button className="primary-button" onClick={retry}>إعادة المحاولة</button>
            </div>
          ) : (
            <>
              {section === 'overview' && <Overview onNavigate={openSection} />}
              {section === 'translate' && <Translate camera={camera} />}
              {section === 'conversation' && <Conversation camera={camera} />}
              {section === 'learn' && <Learn />}
              {section === 'saved' && <Saved />}
              {section === 'settings' && <Settings />}
            </>
          )}
        </div>
        <footer className="page-footer">
          <span>© ٢٠٢٦ SIGNBRIDGE</span>
          <span>مصمّم للتواصل بدون حواجز <span className="footer-heart">♥</span></span>
          <Link to="/privacy">الخصوصية وحدود الخدمة</Link>
          <button onClick={about}>عن المنصة</button>
        </footer>
      </main>
    </div>
  )
}

function Gate() {
  const { status } = useAuth()
  if (status === 'loading') return <div className="splash"><Spinner /></div>
  if (status === 'anonymous') return <AuthScreen />
  return <AppDataProvider><Shell /></AppDataProvider>
}

export default function App() {
  return (
    <BrowserRouter><ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/account-action" element={<AccountAction />} />
          <Route path="/*" element={<Gate />} />
        </Routes>
      </AuthProvider>
    </ToastProvider></BrowserRouter>
  )
}
