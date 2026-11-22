import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '../context/toast-context'

export interface CameraApi {
  stream: MediaStream | null
  on: boolean
  toggle: () => Promise<void>
  stop: () => void
}

/** Local camera preview only. Video is never recorded, stored or sent anywhere. */
export function useCamera(): CameraApi {
  const { notify } = useToast()
  const [stream, setStream] = useState<MediaStream | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setStream(null)
  }, [])

  const toggle = useCallback(async () => {
    if (streamRef.current) { stop(); return }
    if (!navigator.mediaDevices?.getUserMedia) {
      notify('المتصفح لا يدعم الوصول للكاميرا. استخدم متصفحاً حديثاً عبر HTTPS أو localhost.')
      return
    }
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = next
      setStream(next)
      notify('الكاميرا تعمل على جهازك فقط. لا يتم حفظ أو إرسال الفيديو.')
    } catch {
      notify('تعذّر الوصول للكاميرا. تحقّق من الإذن وإعدادات المتصفح.')
    }
  }, [notify, stop])

  // Release the camera when the app unmounts.
  useEffect(() => () => {
     
    streamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  return { stream, on: stream !== null, toggle, stop }
}
