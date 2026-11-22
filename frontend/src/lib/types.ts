export type Role = 'user' | 'student' | 'instructor' | 'admin'

export interface UserSettings {
  player_speed: number
  speech_rate: number
}

export interface User {
  id: string
  email: string
  email_verified: boolean
  display_name: string
  role: Role
  locale: string
  settings: UserSettings
  created_at: string
}

export interface AuthResponse {
  verification_delivery?: string
  expires_in: number
  user: User
}

export type Direction = 'text_to_sign' | 'sign_to_text'

export interface Translation {
  id: string
  direction: Direction
  language_code: string
  input_text: string | null
  output_text: string | null
  status: string
  confidence: number | null
  created_at: string
  clips?: Sign[]
  unknown?: string[]
  segments?: {kind: 'sign' | 'unknown'; text: string; sign_id?: string}[]
  message?: string
}

export interface SavedPhrase {
  id: string
  text: string
  created_at: string
}

export interface Lesson {
  id: string
  title: string
  category: string
  level: string
  icon: string
  color: string
  is_sample: boolean
  item_count: number
  progress: number
  bookmarked: boolean
}

export interface LessonDetail extends Lesson {
  items: { position: number; gloss: string; sign?: Sign }[]
}

export type Speaker = 'me' | 'other'
export type MessageSource = 'typed' | 'dictation'

export interface ConversationMessage {
  id: string
  speaker_label: Speaker
  text: string
  source: MessageSource
  created_at: string
}

export interface Conversation {
  id: string
  created_at: string
  messages: ConversationMessage[]
}

export interface AdminStats {
  users: number
  translations: number
  saved_phrases: number
  conversation_messages: number
  feedback: number
}

export interface Sign {
  id: string
  gloss: string
  category: string
  media_url: string
  media_type: string
  license: string
  attribution: string
  source_url: string
  saved?: boolean
}
export interface Quiz {
  id: string
  title: string
  best_score: number | null
  questions: {id: string; sign_id: string; media_url: string; options: string[]}[]
}
export interface QuizResult {score: number; correct: number; total: number; answers: Record<string,string>}
export interface Feedback {id: string; user_id: string | null; translation_id: string | null; message: string; created_at: string}
