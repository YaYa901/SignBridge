import { useEffect, useRef, useState } from 'react'
import type { Sign } from '../lib/types'

export function SignVideo({ sign, speed = 1, autoPlay = false, onEnded }: {sign: Sign; speed?: number; autoPlay?: boolean; onEnded?: () => void}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => { if (ref.current) ref.current.playbackRate = speed }, [speed, sign.id])
    useEffect(() => {
    if (autoPlay && ref.current) void ref.current.play().catch(() => { /* Native controls remain available. */ })
  }, [autoPlay, sign.media_url])
  return <figure className="sign-video">
    {failed ? <p role="alert">تعذر تحميل الفيديو. أعد تحميل الصفحة.</p> : <video key={sign.media_url} ref={ref} src={sign.media_url} controls playsInline muted autoPlay={autoPlay} preload="metadata" aria-label={`إشارة ${sign.gloss}`} onEnded={onEnded} onError={() => setFailed(true)} />}
    <figcaption><strong>{sign.gloss}</strong> <a href={sign.source_url} target="_blank" rel="noreferrer">مصدر الفيديو</a> · {sign.license}</figcaption>
  </figure>
}

export function VideoSequence({ clips, speed = 1 }: {clips: Sign[]; speed?: number}) {
  const [index, setIndex] = useState(0)
  const [auto, setAuto] = useState(false)
  const sign = clips[index]
  if (!sign) return <p>لا توجد فيديوهات مطابقة.</p>
  return <div className="video-sequence">
    <SignVideo key={index} sign={sign} speed={speed} autoPlay={auto} onEnded={() => { if (index < clips.length - 1) setIndex(index + 1); else setAuto(false) }} />
    <div className="sequence-controls">
      <button className="outline-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>السابق</button>
      <span dir="ltr">{index + 1} / {clips.length}</span>
      <button className="primary-button" onClick={() => { setIndex(0); setAuto(true) }}>تشغيل التسلسل</button>
      <button className="outline-button" disabled={index === clips.length - 1} onClick={() => setIndex(index + 1)}>التالي</button>
    </div>
    <div className="filter-chips">{clips.map((s,i) => <button key={`${s.id}-${i}`} aria-pressed={index === i} onClick={() => setIndex(i)}>{s.gloss}</button>)}</div>
  </div>
}
