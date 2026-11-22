import { createContext, useContext } from 'react'
import type { Conversation, Direction, Lesson, MessageSource, SavedPhrase, Speaker, Translation } from '../lib/types'

export interface AppData {
  loading: boolean
  error: string | null
  retry: () => void
  translations: Translation[]
  phrases: SavedPhrase[]
  lessons: Lesson[]
  conversation: Conversation | null
  addTranslation: (direction: Direction, text: string) => Promise<Translation>
  clearTranslations: () => Promise<void>
  addPhrase: (text: string) => Promise<SavedPhrase>
  removePhrase: (id: string) => Promise<void>
  clearPhrases: () => Promise<void>
  toggleBookmark: (lessonId: string) => Promise<void>
  setLessonProgress: (lessonId: string, progress: number) => Promise<void>
  sendMessage: (text: string, speaker: Speaker, source: MessageSource) => Promise<void>
  resetConversation: () => Promise<void>
}

export const AppDataContext = createContext<AppData | null>(null)

export function useAppData(): AppData {
  const value = useContext(AppDataContext)
  if (!value) throw new Error('useAppData must be used inside <AppDataProvider>')
  return value
}
