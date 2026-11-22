import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { errorMessage } from '../lib/errors'
import type { Conversation, Lesson, SavedPhrase, Translation } from '../lib/types'
import { AppDataContext, type AppData } from './app-data-context'

const HISTORY_LIMIT = 30

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [translations, setTranslations] = useState<Translation[]>([])
  const [phrases, setPhrases] = useState<SavedPhrase[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Independent requests run in parallel (no waterfall).
  useEffect(() => {
    let cancelled = false
    Promise.all([api.listTranslations(HISTORY_LIMIT), api.listPhrases(), api.listLessons(), api.getConversation()])
      .then(([tr, ph, ls, cv]) => {
        if (cancelled) return
        setTranslations(tr); setPhrases(ph); setLessons(ls); setConversation(cv)
        setError(null)
      })
      .catch(e => { if (!cancelled) setError(errorMessage(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [attempt])

  const retry = useCallback(() => { setLoading(true); setError(null); setAttempt(n => n + 1) }, [])

  const addTranslation = useCallback<AppData['addTranslation']>(async (direction, text) => {
    const created = await api.createTranslation(direction, text)
    setTranslations(current => [created, ...current].slice(0, HISTORY_LIMIT))
    return created
  }, [])

  const clearTranslations = useCallback(async () => {
    await api.clearTranslations()
    setTranslations([])
  }, [])

  const addPhrase = useCallback<AppData['addPhrase']>(async text => {
    const phrase = await api.addPhrase(text)
    setPhrases(current => (current.some(p => p.id === phrase.id) ? current : [phrase, ...current]))
    return phrase
  }, [])

  const removePhrase = useCallback(async (id: string) => {
    await api.deletePhrase(id)
    setPhrases(current => current.filter(p => p.id !== id))
  }, [])

  const clearPhrases = useCallback(async () => {
    await api.clearPhrases()
    setPhrases([])
  }, [])

  const toggleBookmark = useCallback(async (lessonId: string) => {
    const lesson = lessons.find(l => l.id === lessonId)
    if (!lesson) return
    const updated = await api.setBookmark(lessonId, !lesson.bookmarked)
    setLessons(current => current.map(l => (l.id === lessonId ? { ...l, bookmarked: updated.bookmarked } : l)))
  }, [lessons])

  const setLessonProgress = useCallback(async (lessonId: string, progress: number) => {
    const updated = await api.setProgress(lessonId, progress)
    setLessons(current => current.map(l => (l.id === lessonId ? { ...l, progress: updated.progress } : l)))
  }, [])

  const sendMessage = useCallback<AppData['sendMessage']>(async (text, speaker, source) => {
    const message = await api.sendMessage(text, speaker, source)
    setConversation(current => (current ? { ...current, messages: [...current.messages, message] } : current))
  }, [])

  const resetConversation = useCallback(async () => {
    setConversation(await api.resetConversation())
  }, [])

  const value = useMemo<AppData>(() => ({
    loading, error, retry, translations, phrases, lessons, conversation,
    addTranslation, clearTranslations, addPhrase, removePhrase, clearPhrases,
    toggleBookmark, setLessonProgress, sendMessage, resetConversation,
  }), [loading, error, retry, translations, phrases, lessons, conversation, addTranslation, clearTranslations,
    addPhrase, removePhrase, clearPhrases, toggleBookmark, setLessonProgress, sendMessage, resetConversation])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
