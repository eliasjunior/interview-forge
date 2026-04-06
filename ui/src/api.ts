import type {
  Session,
  KnowledgeGraph,
  ReportMeta,
  Flashcard,
  FlashcardAnswer,
  ReviewRating,
  Mistake,
  GraphInspectionResult,
  SessionDeletionPreview,
  SessionDeleteResult,
  ProgressOverview,
  ProgressSessionKind,
  SessionRewardSummary,
  TopicPlan,
  TopicPlanPriority,
} from '@mock-interview/shared'

const BASE = '/api'

async function req<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${url}`)
  return res.json() as Promise<T>
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${url}`)
  return res.json() as Promise<T>
}

async function del<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${url}`)
  return res.json() as Promise<T>
}

export interface Topic {
  file: string
  displayName: string
}

export const getTopics = (): Promise<Topic[]> => req(`${BASE}/topics`)
export const getTopicPlans = (): Promise<TopicPlan[]> => req(`${BASE}/topic-plans`)
export const updateTopicPlan = (topic: string, plan: { focused: boolean; priority: TopicPlanPriority }): Promise<TopicPlan> =>
  fetch(`${BASE}/topic-plans/${encodeURIComponent(topic)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${BASE}/topic-plans/${encodeURIComponent(topic)}`)
    return res.json() as Promise<TopicPlan>
  })

export interface TopicLevel {
  topic: string
  level: 0 | 1 | 2 | 3 | 4
  /** 'cold' = never attempted, 'warmup' = in the ladder, 'dropped' = fell back, 'ready' = mock-ready or interview-ready */
  status: 'cold' | 'warmup' | 'dropped' | 'ready'
  reason: string
  nextLevelRequirement: string
  hasWarmupContent: boolean
  progress: {
    current: number
    required: number
    targetLevel: 0 | 1 | 2 | 3 | 4
    variant: 'warmup' | 'interview' | 'complete'
    label: string
    attempted: boolean
    almostThere: boolean
  }
}

export const getTopicLevel = (topic: string): Promise<TopicLevel> =>
  req(`${BASE}/topics/${encodeURIComponent(topic)}/level`)

export const getSessions = (): Promise<Session[]> => req(`${BASE}/sessions`)

export interface ScopedInterviewStartRequest {
  topic: string
  content: string
  focus?: string
}

export interface ScopedInterviewStartResponse {
  sessionId: string
  state: Session['state']
  topic: string
  focusArea: string
  source: string
  parsed:
    | { contentType: 'algorithm' }
    | { contentType: 'api'; endpoints: string[]; models: string[]; rules: string[]; gaps: string[] }
  totalQuestions: number
  previewQuestions: string[]
  normalizedContent: string
  detectedContentType: 'algorithm' | 'api'
  nextTool: 'ask_question'
}

export const createScopedInterview = (body: ScopedInterviewStartRequest): Promise<ScopedInterviewStartResponse> =>
  post(`${BASE}/scoped-interviews`, body)


export interface ProgressQuery {
  sessionKind?: ProgressSessionKind
  weakScoreThreshold?: number
  recentSessionsLimit?: number
  topicLimit?: number
}

export const getProgressOverview = (query: ProgressQuery = {}): Promise<ProgressOverview> => {
  const params = new URLSearchParams()
  if (query.sessionKind) params.set('sessionKind', query.sessionKind)
  if (typeof query.weakScoreThreshold === 'number') params.set('weakScoreThreshold', String(query.weakScoreThreshold))
  if (typeof query.recentSessionsLimit === 'number') params.set('recentSessionsLimit', String(query.recentSessionsLimit))
  if (typeof query.topicLimit === 'number') params.set('topicLimit', String(query.topicLimit))
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return req(`${BASE}/progress${suffix}`)
}
export const getSession = async (id: string): Promise<Session | null> => {
  const sessions = await getSessions()
  return sessions.find(s => s.id === id) ?? null
}

export const getSessionRewardSummary = (id: string): Promise<SessionRewardSummary> =>
  req(`${BASE}/sessions/${encodeURIComponent(id)}/reward-summary`)

export interface SessionLaunchPrompt {
  sessionId: string
  title: string
  prompt: string
  nextTool: 'get_session'
}

export const getSessionLaunchPrompt = (id: string): Promise<SessionLaunchPrompt> =>
  req(`${BASE}/sessions/${encodeURIComponent(id)}/launch-prompt`)

export const getSessionDeletePreview = (id: string): Promise<SessionDeletionPreview> =>
  req(`${BASE}/sessions/${encodeURIComponent(id)}/delete-preview`)

export const deleteSession = (id: string): Promise<SessionDeleteResult> =>
  del(`${BASE}/sessions/${encodeURIComponent(id)}`)

export const getReports = (): Promise<ReportMeta[]> => req(`${BASE}/reports`)

export const getGraph = (): Promise<KnowledgeGraph> => req(`${BASE}/graph`)
export const inspectGraphNodes = (nodeIds: string[]): Promise<GraphInspectionResult> =>
  post(`${BASE}/graph/inspect`, { nodeIds })

export const getFlashcards = (includeArchived = false): Promise<Flashcard[]> =>
  req(`${BASE}/flashcards${includeArchived ? '?includeArchived=true' : ''}`)

export const getMistakes = (topic?: string): Promise<Mistake[]> =>
  req(`${BASE}/mistakes${topic ? `?topic=${encodeURIComponent(topic)}` : ''}`)

export const reviewFlashcard = (id: string, rating: ReviewRating): Promise<Flashcard> =>
  post(`${BASE}/flashcards/${encodeURIComponent(id)}/review`, { rating })

export const submitFlashcardAnswer = (
  id: string,
  content: string,
  smRating?: ReviewRating
): Promise<FlashcardAnswer> =>
  post(`${BASE}/flashcards/${encodeURIComponent(id)}/answers`, { content, smRating })

export const dismissFlashcard = (id: string): Promise<Flashcard> =>
  post(`${BASE}/flashcards/${encodeURIComponent(id)}/archive`, {})

export const restoreFlashcard = (id: string): Promise<Flashcard> =>
  post(`${BASE}/flashcards/${encodeURIComponent(id)}/unarchive`, {})

export interface ReportUiQuestion {
  questionNumber: number
  subject?: string
  question: string
  candidateAnswer: string
  interviewerFeedback: string
  score?: number
  strongAnswer: string
}

export interface ReportUiDataset {
  sessionId: string
  topic: string
  title: string
  generatedAt: string
  questions: ReportUiQuestion[]
}

export interface ReportUiResponseReady {
  ready: true
  sessionId: string
  state: Session['state']
  dataset: ReportUiDataset
}

export interface ReportUiResponsePending {
  ready: false
  sessionId: string
  state: Session['state']
  message: string
}

export type ReportUiResponse = ReportUiResponseReady | ReportUiResponsePending

export async function getGeneratedReportUi(id: string): Promise<ReportUiDataset | null> {
  const res = await fetch(`${BASE}/sessions/${encodeURIComponent(id)}/report-ui`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${BASE}/sessions/${encodeURIComponent(id)}/report-ui`)
  const payload = await res.json() as ReportUiResponse
  return payload.ready ? payload.dataset : null
}
