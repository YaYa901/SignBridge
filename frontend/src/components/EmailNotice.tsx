import { useEffect, useState } from 'react'
import { api } from '../lib/api'
export function EmailNotice() {
  const [mode,setMode]=useState('')
  useEffect(() => {let live=true;api.emailStatus().then(r => {if(live)setMode(r.mode)}).catch(() => {});return () => {live=false}},[])
  if(mode==='test_mailbox')return <p className="email-notice">وضع عرض المشروع: كل رسائل التأكيد والاستعادة تصل إلى <a href="http://localhost:8025" target="_blank" rel="noreferrer">صندوق البريد التجريبي Mailpit</a> على نفس الجهاز، وليس إلى بريد حقيقي. يمكنك استخدام أي عنوان تجريبي.</p>
  if(mode==='local_outbox')return <p className="email-notice">وضع التطوير: رسائل التأكيد والاستعادة محفوظة كملفات EML في data/dev-outbox على الخادم. شغل Mailpit للعرض في متصفح.</p>
  if(mode==='unavailable')return <p className="email-notice">خدمة البريد غير مهيأة على هذه النسخة.</p>
  return null
}
