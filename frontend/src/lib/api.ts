import type {
  AdminStats, AuthResponse, Conversation, ConversationMessage, Direction, Lesson, LessonDetail,
  MessageSource, SavedPhrase, Speaker, Translation, User, UserSettings,
} from './types'

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}


let onUnauthorized: (() => void) | null = null
/** AuthProvider registers a callback so any 401 on an authenticated call logs the user out. */
export function setUnauthorizedHandler(handler: (() => void) | null) { onUnauthorized = handler }

interface RequestOptions { method?: string; body?: unknown; auth?: boolean }

async function request<T>(path: string, { method = 'GET', body, auth = true }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  headers['X-SignBridge'] = '1'

  let response: Response
  try {
    response = await fetch(`${BASE}/api${path}`, { method, headers, credentials: 'include', body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'تعذّر الاتصال بالخادم. تأكّد من تشغيل الـ API ثم حاول مجدداً.')
  }

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && auth) onUnauthorized?.()
    const detail = (data as { detail?: unknown } | null)?.detail
    throw new ApiError(response.status, typeof detail === 'string' ? detail : 'حدث خطأ غير متوقع. حاول مرة أخرى.')
  }
  return data as T
}

export const api = {
  emailStatus: () => request<{mode:string}>('/auth/email-status',{auth:false}),
  logout: () => request<{logged_out: boolean}>('/auth/logout', {method: 'POST', auth: false}),
  requestEmail: (email: string, purpose: 'verify' | 'reset') => request<{message: string}>('/auth/request-email', {method:'POST', auth:false, body:{email,purpose}}),
  completeEmail: (token: string, purpose: 'verify' | 'reset', password = '') => request<{message: string}>('/auth/complete-email', {method:'POST',auth:false,body:{token,purpose,password}}),
  dictionary: () => request<import('./types').Sign[]>('/dictionary'),
  saveSign: (id: string, on: boolean) => request(`/dictionary/${encodeURIComponent(id)}/saved`,{method:on?'PUT':'DELETE'}),
  getQuiz: (id: string) => request<import('./types').Quiz>(`/lessons/${encodeURIComponent(id)}/quiz`),
  submitQuiz: (id: string, answers: Record<string,string>) => request<import('./types').QuizResult>(`/lessons/${encodeURIComponent(id)}/quiz`,{method:'POST',body:{answers}}),
  adminFeedback: (offset = 0) => request<import('./types').Feedback[]>(`/admin/feedback?offset=${offset}`),
  // auth
  register: (email: string, password: string, display_name: string) =>
    request<AuthResponse>('/auth/register', { method: 'POST', auth: false, body: { email, password, display_name } }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', auth: false, body: { email, password } }),
  me: () => request<User>('/auth/me'),
  updateName: (display_name: string) => request<User>('/auth/me', { method: 'PATCH', body: { display_name } }),
  updateSettings: (settings: Partial<UserSettings>) => request<User>('/settings', { method: 'PUT', body: settings }),
  changePassword: (current_password: string, new_password: string) =>
    request<AuthResponse>('/auth/change-password', { method: 'POST', body: { current_password, new_password } }),
  deleteAccount: (password: string) => request<{ deleted: boolean }>('/auth/delete-account', { method: 'POST', body: { password } }),
  exportData: () => request<Record<string, unknown>>('/me/export'),

  // translations
  createTranslation: (direction: Direction, input_text: string) =>
    request<Translation>('/translations', { method: 'POST', body: { direction, input_text } }),
  listTranslations: (limit = 30, offset = 0) => request<Translation[]>(`/translations?limit=${limit}&offset=${offset}`),
  allTranslations: async () => {
    const rows: Translation[] = []
    for (let offset = 0; ; offset += 100) {
      const page = await api.listTranslations(100, offset)
      rows.push(...page)
      if (page.length < 100) return rows
    }
  },
  clearTranslations: () => request<{ deleted: number }>('/translations', { method: 'DELETE' }),

  // saved phrases
  listPhrases: () => request<SavedPhrase[]>('/saved-phrases'),
  addPhrase: (text: string) => request<SavedPhrase>('/saved-phrases', { method: 'POST', body: { text } }),
  deletePhrase: (id: string) => request<{ deleted: boolean }>(`/saved-phrases/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  clearPhrases: () => request<{ deleted: number }>('/saved-phrases', { method: 'DELETE' }),

  // lessons
  listLessons: () => request<Lesson[]>('/lessons'),
  getLesson: (id: string) => request<LessonDetail>(`/lessons/${encodeURIComponent(id)}`),
  setProgress: (id: string, progress: number) =>
    request<LessonDetail>(`/lessons/${encodeURIComponent(id)}/progress`, { method: 'PUT', body: { progress } }),
  setBookmark: (id: string, on: boolean) =>
    request<LessonDetail>(`/lessons/${encodeURIComponent(id)}/bookmark`, { method: on ? 'PUT' : 'DELETE' }),

  // conversation
  getConversation: () => request<Conversation>('/conversation'),
  sendMessage: (text: string, speaker: Speaker, source: MessageSource) =>
    request<ConversationMessage>('/conversation/messages', { method: 'POST', body: { text, speaker, source } }),
  resetConversation: () => request<Conversation>('/conversation/reset', { method: 'POST' }),

  // misc
  sendFeedback: (message: string, translation_id?: string) => request<{ id: string; created: boolean }>('/feedback', { method: 'POST', body: { message, translation_id } }),
  adminStats: () => request<AdminStats>('/admin/stats'),
}
