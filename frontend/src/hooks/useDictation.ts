import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '../context/toast-context'

interface RecognitionEvent { results: ArrayLike<ArrayLike<{ transcript: string }>> }
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  start: () => void
  stop: () => void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Browser speech-to-text (Arabic, Egypt). Privacy depends on the browser vendor's speech service. */
export function useDictation() {
  const { notify } = useToast()
  const [listening, setListening] = useState(false)
  const ref = useRef<Recognition | null>(null)

  const stop = useCallback(() => { ref.current?.stop() }, [])

  /** `base` is the text already typed; spoken words are appended to it via `onText`. */
  const toggle = useCallback((base: string, onText: (text: string) => void) => {
    if (ref.current) { ref.current.stop(); return }
    const Ctor = recognitionCtor()
    if (!Ctor) { notify('التعرّف على الكلام غير متاح في هذا المتصفح. اكتب النص بدلاً من ذلك.'); return }
    const recognition = new Ctor()
    recognition.lang = 'ar-EG'
    recognition.interimResults = true
    recognition.continuous = true
    const prefix = base && !/\s$/.test(base) ? `${base} ` : base
    recognition.onresult = event => {
      const spoken = Array.from(event.results, result => result[0]?.transcript ?? '').join('')
      onText(prefix + spoken)
    }
    recognition.onerror = event => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') notify('تعذّر استخدام الميكروفون. تحقّق من إذن المتصفح.')
    }
    recognition.onend = () => { ref.current = null; setListening(false) }
    try {
      recognition.start()
      ref.current = recognition
      setListening(true)
    } catch {
      notify('تعذّر بدء الميكروفون. تحقّق من إذن المتصفح.')
    }
  }, [notify])

  useEffect(() => () => {
     
    ref.current?.stop()
  }, [])

  return { listening, toggle, stop }
}
