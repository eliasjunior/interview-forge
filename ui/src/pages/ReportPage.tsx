import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { deleteSession, getGeneratedReportUi, getSession, getSessionDeletePreview, type ReportUiDataset } from '../api'
import type { Session, Evaluation, Concept, SessionDeletionPreview, SessionKind } from '@mock-interview/shared'
import ScoreBadge, { ScoreBar } from '../components/ScoreBadge'

function calcAvg(evals: Evaluation[]): string {
  if (!evals.length) return 'N/A'
  return (evals.reduce((s, e) => s + e.score, 0) / evals.length).toFixed(1)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

const CLUSTER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'core concepts':   { bg: '#183a4480', border: 'var(--accent)',   text: '#d9fffb' },
  'practical usage': { bg: '#1e1b4b80', border: '#818cf8',         text: '#c7d2fe' },
  'tradeoffs':       { bg: '#431a0080', border: '#fb923c',         text: '#fed7aa' },
  'best practices':  { bg: '#052e1680', border: 'var(--success)', text: '#bbf7d0' },
}

function conceptStyle(cluster: string) {
  return CLUSTER_COLORS[cluster] ?? { bg: 'var(--bg-soft)', border: 'var(--line)', text: 'var(--muted)' }
}

type Tab = 'overview' | 'questions' | 'transcript'

function getSessionKind(session: Session): SessionKind {
  return session.sessionKind ?? 'interview'
}

function getStudyCategory(session: Session): 'topic' | 'algorithm' {
  return session.studyCategory ?? 'topic'
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [reportUi, setReportUi] = useState<ReportUiDataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [openQ, setOpenQ] = useState<number | null>(0)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([getSession(id), getGeneratedReportUi(id)])
      .then(([s, dataset]) => {
        setSession(s)
        setReportUi(dataset)
        if (!s) setError('Session not found')
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="loading">Loading report…</div>
  if (error || !session) return <div className="error-msg">{error ?? 'Session not found'}</div>

  const avg = calcAvg(session.evaluations)
  const isStudy = getSessionKind(session) === 'study'
  const isAlgorithmStudy = isStudy && getStudyCategory(session) === 'algorithm'
  const tabs: Tab[] = isStudy ? ['overview', 'questions'] : ['overview', 'questions', 'transcript']

  async function handleDeleteSession() {
    if (deleteBusy || !session) return
    const currentSession = session

    try {
      setDeleteBusy(true)
      const preview = await getSessionDeletePreview(currentSession.id)
      if (!window.confirm(buildDeleteConfirmation(preview))) return
      await deleteSession(currentSession.id)
      navigate('/sessions')
    } catch (e) {
      setError(String(e))
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div>
      <div className="page-actions">
        <button className="btn-back" onClick={() => navigate('/sessions')}>
          ← Back to sessions
        </button>
        <button className="btn-danger" onClick={handleDeleteSession} disabled={deleteBusy}>
          {deleteBusy ? 'Deleting…' : 'Delete session'}
        </button>
      </div>

      {/* Header */}
      <div className="report-header">
        <div>
          <div className="report-title">{session.topic}</div>
          <div className="report-meta-row">
            <span>{formatDate(session.createdAt)}</span>
            <span>·</span>
            <span>ID: <code style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>{session.id}</code></span>
            <span>·</span>
            <span className={`tag ${isStudy ? 'tag-study' : session.state === 'ENDED' ? 'tag-ended' : 'tag-active'}`}>
              {isStudy ? 'Study Session' : session.state === 'ENDED' ? '✓ Completed' : '⏳ In progress'}
            </span>
            {isStudy && (
              <span className={`tag ${isAlgorithmStudy ? 'tag-algorithm' : 'tag-topic'}`}>
                {isAlgorithmStudy ? 'Algorithm' : 'Topic'}
              </span>
            )}
          </div>
        </div>
        <ScoreBadge score={avg} size="lg" />
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{isStudy ? session.questions.length : session.evaluations.length}</div>
          <div className="stat-label">{isStudy ? 'Study prompts' : 'Questions answered'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{isStudy ? (isAlgorithmStudy ? 'Code' : 'Topic') : avg}</div>
          <div className="stat-label">{isStudy ? 'Study type' : 'Avg score'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{session.concepts?.length ?? 0}</div>
          <div className="stat-label">Concepts extracted</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ textTransform: 'capitalize', fontSize: isStudy ? '0.95rem' : '1rem', paddingTop: 4 }}>
            {isStudy ? (session.sourceType ?? session.knowledgeSource) : session.knowledgeSource}
          </div>
          <div className="stat-label">{isStudy ? 'Source format' : 'Knowledge source'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t}
            className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {isStudy && t === 'questions' ? 'Prompts' : t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'questions' && ` (${isStudy ? session.questions.length : session.evaluations.length})`}
            {t === 'transcript' && ` (${session.messages.length})`}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div>
          {isStudy && (
            <div className="study-summary-box" style={{ marginBottom: 24 }}>
              <div className="page-subtitle" style={{ marginBottom: 8 }}>
                {isAlgorithmStudy ? 'Algorithm study note' : 'Study note'}
              </div>
              <div className="qa-section-text">
                {session.summary ?? 'Seeded study session with prompts and concepts, but no interview transcript yet.'}
              </div>
              {(session.sourcePath || session.seeded) && (
                <div className="study-source-meta">
                  {session.sourcePath && <span>Source: <code>{session.sourcePath}</code></span>}
                  {session.seeded && <span>Seeded placeholder session</span>}
                </div>
              )}
            </div>
          )}

          {!isStudy && session.summary && (
            <div style={{ marginBottom: 24 }}>
              <div className="page-subtitle" style={{ marginBottom: 8 }}>Summary</div>
              <div className="summary-box">{session.summary}</div>
            </div>
          )}

          {session.concepts && session.concepts.length > 0 && (
            <div>
              <div className="page-subtitle" style={{ marginBottom: 12 }}>Concepts Extracted</div>
              <ConceptsSection concepts={session.concepts} />
            </div>
          )}

          {!session.summary && (!session.concepts || session.concepts.length === 0) && (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-msg">
                {isStudy
                  ? 'Study session has no summary or concepts yet.'
                  : 'Session not yet finalized — complete the interview to see the overview.'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Questions */}
      {tab === 'questions' && (
        <div className="question-list">
          {isStudy ? (
            session.questions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🧠</div>
                <div className="empty-state-msg">No study prompts yet.</div>
              </div>
            ) : (
              session.questions.map((question, idx) => (
                <StudyPromptCard
                  key={idx}
                  idx={idx}
                  question={question}
                  open={openQ === idx}
                  onToggle={() => setOpenQ(openQ === idx ? null : idx)}
                />
              ))
            )
          ) : session.evaluations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">❓</div>
              <div className="empty-state-msg">No questions answered yet.</div>
            </div>
          ) : (
            session.evaluations.map((ev, idx) => (
              <QuestionCard
                key={idx}
                idx={idx}
                ev={ev}
                strongAnswer={ev.strongAnswer ?? reportUi?.questions[idx]?.strongAnswer}
                open={openQ === idx}
                onToggle={() => setOpenQ(openQ === idx ? null : idx)}
              />
            ))
          )}
        </div>
      )}

      {/* Tab: Transcript */}
      {!isStudy && tab === 'transcript' && (
        <div className="transcript">
          {session.messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-msg">No messages yet.</div>
            </div>
          ) : (
            session.messages.map((msg, idx) => (
              <div key={idx} className={`transcript-msg ${msg.role}`}>
                <div className="transcript-role">
                  {msg.role === 'interviewer' ? '🎙 Interviewer' : '🧑‍💻 Candidate'}
                </div>
                <div className="transcript-bubble">{msg.content}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function buildDeleteConfirmation(preview: SessionDeletionPreview): string {
  const lines = [
    `Delete session "${preview.session.topic}"?`,
    '',
    `ID: ${preview.session.id}`,
    `State: ${preview.session.state}`,
    `Questions: ${preview.session.questionCount}`,
    `Messages: ${preview.session.messageCount}`,
    `Evaluations: ${preview.session.evaluationCount}`,
    `Flashcards to delete: ${preview.flashcards.count}`,
    `Markdown report: ${preview.artifacts.markdownReport ? 'yes' : 'no'}`,
    `Report UI dataset: ${preview.artifacts.reportUiDataset ? 'yes' : 'no'}`,
    `Weak-subjects HTML: ${preview.artifacts.weakSubjectsHtml ? 'yes' : 'no'}`,
  ]

  if (preview.warnings.length > 0) {
    lines.push('', 'Warnings:')
    for (const warning of preview.warnings) {
      lines.push(`- ${warning}`)
    }
  }

  lines.push('', 'This cannot be undone.')
  return lines.join('\n')
}

function StudyPromptCard({ idx, question, open, onToggle }: {
  idx: number
  question: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="question-card study-prompt-card">
      <div className="question-card-header" onClick={onToggle}>
        <span className="question-num">P{idx + 1}</span>
        <span className="question-text">{question}</span>
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="question-card-body">
          <div>
            <div className="qa-section-label">Prompt</div>
            <div className="qa-section-text">{question}</div>
          </div>
          <div className="study-callout">
            This is a seeded study prompt. No interview transcript or scoring has been recorded for this session yet.
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionCard({ ev, idx, strongAnswer, open, onToggle }: {
  ev: Evaluation
  idx: number
  strongAnswer?: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="question-card">
      <div className="question-card-header" onClick={onToggle}>
        <span className="question-num">Q{idx + 1}</span>
        <ScoreBar score={ev.score} />
        <ScoreBadge score={ev.score} size="sm" />
        <span className="question-text">{ev.question}</span>
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="question-card-body">
          <div>
            <div className="qa-section-label">Your answer</div>
            <div className="qa-section-text">{ev.answer}</div>
          </div>
          <div>
            <div className="qa-section-label">Feedback</div>
            <div className="qa-section-text">{ev.feedback}</div>
          </div>
          {strongAnswer && (
            <div className="strong-answer-box">
              <div className="qa-section-label">Strong answer</div>
              <div className="qa-section-text strong-answer-text">{strongAnswer}</div>
            </div>
          )}
          {ev.deeperDive && !ev.deeperDive.startsWith('ERROR') && (
            <div>
              <div className="qa-section-label">🔍 Where to go deeper</div>
              <div className="deeper-dive">{ev.deeperDive}</div>
            </div>
          )}
          {ev.followUpQuestion && (
            <div>
              <div className="qa-section-label">Follow-up question asked</div>
              <div className="qa-section-text" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                {ev.followUpQuestion}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ConceptsSection({ concepts }: { concepts: Concept[] }) {
  const byCluster: Record<string, string[]> = {}
  for (const c of concepts) {
    ;(byCluster[c.cluster] ??= []).push(c.word)
  }

  return (
    <div className="concepts-section">
      {Object.entries(byCluster).map(([cluster, words]) => {
        const style = conceptStyle(cluster)
        return (
          <div key={cluster} className="concepts-cluster">
            <div className="cluster-label">{cluster}</div>
            <div className="concepts-chips">
              {words.map(w => (
                <span
                  key={w}
                  className="concept-chip"
                  style={{ background: style.bg, borderColor: style.border, color: style.text }}
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
