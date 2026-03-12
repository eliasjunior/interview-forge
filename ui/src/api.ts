import type { Session, KnowledgeGraph, ReportMeta } from '@mock-interview/shared'

const BASE = '/api'

async function req<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${url}`)
  return res.json() as Promise<T>
}

export const getSessions = (): Promise<Session[]> => req(`${BASE}/sessions`)

export const getSession = async (id: string): Promise<Session | null> => {
  const sessions = await getSessions()
  return sessions.find(s => s.id === id) ?? null
}

export const getReports = (): Promise<ReportMeta[]> => req(`${BASE}/reports`)

export const getGraph = (): Promise<KnowledgeGraph> => req(`${BASE}/graph`)

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

export async function getGeneratedReportUi(id: string): Promise<ReportUiDataset | null> {
  const res = await fetch(`/generated/${encodeURIComponent(id)}-report-ui.json`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Request failed: ${res.status} /generated/${id}-report-ui.json`)
  return res.json() as Promise<ReportUiDataset>
}
