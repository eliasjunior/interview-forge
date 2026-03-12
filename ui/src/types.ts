export type InterviewState =
  | 'ASK_QUESTION'
  | 'WAIT_FOR_ANSWER'
  | 'EVALUATE_ANSWER'
  | 'FOLLOW_UP'
  | 'ENDED'

export interface Message {
  role: 'interviewer' | 'candidate'
  content: string
  timestamp: string
}

export interface Evaluation {
  questionIndex: number
  question: string
  answer: string
  score: number
  feedback: string
  needsFollowUp: boolean
  followUpQuestion?: string
  deeperDive?: string
}

export interface Concept {
  word: string
  cluster: string
}

export interface Session {
  id: string
  topic: string
  state: InterviewState
  currentQuestionIndex: number
  questions: string[]
  messages: Message[]
  evaluations: Evaluation[]
  summary?: string
  concepts?: Concept[]
  createdAt: string
  endedAt?: string
  knowledgeSource: 'file' | 'ai'
}

export interface ReportMeta {
  id: string
  topic: string
  avgScore: string
  date: string | null
  file: string
}

export interface GraphNode {
  id: string
  label: string
  clusters: string[]
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  sessions: string[]
}
