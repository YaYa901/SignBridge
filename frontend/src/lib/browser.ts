/** Small wrappers around browser features that may be missing or blocked. */

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Reads text aloud with the browser's speech synthesis. Returns false when unsupported. */
export function speak(text: string, rate = 1): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ar-EG'
  utterance.rate = rate
  window.speechSynthesis.speak(utterance)
  return true
}
