import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessions } from '../api'
import type { Session, SessionKind } from '@mock-interview/shared'
import ScoreBadge from '../components/ScoreBadge'

type SessionDayGroup = {
  key: string
  label: string
  sessions: Session[]
}

function calcAvg(session: Session): string {
  if (!session.evaluations.length) return 'N/A'
  const avg = session.evaluations.reduce((s, e) => s + e.score, 0) / session.evaluations.length
  return avg.toFixed(1)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function getSessionSortDate(session: Session): string {
  return session.state === 'ENDED' ? (session.endedAt ?? session.createdAt) : session.createdAt
}

function getDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDayLabel(date: Date): string {
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (target.getTime() === today.getTime()) return 'Today'
  if (target.getTime() === yesterday.getTime()) return 'Yesterday'

  return formatDate(date.toISOString())
}

function groupSessionsByDay(items: Session[]): SessionDayGroup[] {
  const groups = new Map<string, SessionDayGroup>()

  for (const session of items) {
    const date = new Date(getSessionSortDate(session))
    const key = getDayKey(date)
    const existing = groups.get(key)

    if (existing) {
      existing.sessions.push(session)
      continue
    }

    groups.set(key, {
      key,
      label: getDayLabel(date),
      sessions: [session],
    })
  }

  return Array.from(groups.values())
}

function getSessionKind(session: Session): SessionKind {
  return session.sessionKind ?? 'interview'
}

function getStudyCategory(session: Session): 'topic' | 'algorithm' {
  return session.studyCategory ?? 'topic'
}

function getInterviewType(session: Session): string {
  const type = session.interviewType ?? 'design'
  return type === 'code' ? '💻 Code' : '🏗️ Design'
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    getSessions()
      .then(data => {
        const sorted = [...data].sort(
          (a, b) => new Date(getSessionSortDate(b)).getTime() - new Date(getSessionSortDate(a)).getTime()
        )
        setSessions(sorted)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading sessions…</div>
  if (error) return <div className="error-msg">Failed to load sessions: {error}</div>

  const study = sessions.filter(s => getSessionKind(s) === 'study')
  const ended = sessions.filter(s => s.state === 'ENDED')
  const active = sessions.filter(s => s.state !== 'ENDED')
  const activeGroups = groupSessionsByDay(active)
  const endedGroups = groupSessionsByDay(ended)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sessions</h1>
        <p className="page-subtitle">
          {ended.length} completed · {active.length} in progress · {study.length} study sessions
        </p>
      </div>

      {sessions.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-msg">No sessions yet. Start an interview with the MCP server.</div>
        </div>
      )}

      {activeGroups.length > 0 && (
        <>
          <h2 className="sessions-section-title">In Progress</h2>
          <SessionDayGroups groups={activeGroups} onSelect={id => navigate(`/sessions/${id}`)} />
        </>
      )}

      {endedGroups.length > 0 && (
        <>
          <h2 className="sessions-section-title">Completed</h2>
          <SessionDayGroups groups={endedGroups} onSelect={id => navigate(`/sessions/${id}`)} />
        </>
      )}
    </div>
  )
}

function SessionDayGroups({ groups, onSelect }: { groups: SessionDayGroup[]; onSelect: (id: string) => void }) {
  return (
    <div className="session-day-groups">
      {groups.map(group => (
        <section key={group.key} className="session-day-group">
          <div className="session-day-heading">{group.label}</div>
          <div className="sessions-grid">
            {group.sessions.map(session => (
              <SessionCard key={session.id} session={session} onClick={() => onSelect(session.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function SessionCard({ session, onClick }: { session: Session; onClick: () => void }) {
  const avg = calcAvg(session)
  const isEnded = session.state === 'ENDED'
  const isStudy = getSessionKind(session) === 'study'
  const studyCategory = getStudyCategory(session)
  const detail = isStudy
    ? `${session.questions.length} study prompts · ${studyCategory === 'algorithm' ? 'algorithm walkthrough' : 'topic notes'}`
    : `${session.evaluations.length} of ${session.questions.length} questions answered`

  return (
    <div className={`card card-hover${isStudy ? ' study-card' : ''}`} onClick={onClick}>
      <div className="session-card-topic">{session.topic}</div>

      <div style={{ fontSize: '0.83rem', color: 'var(--muted)' }}>
        {formatDate(session.createdAt)}
      </div>

      <div style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--muted)' }}>
        {detail}
      </div>

      <div className="session-card-meta">
        <ScoreBadge score={avg} />
        <span className={`tag ${isStudy ? 'tag-study' : isEnded ? 'tag-ended' : 'tag-active'}`}>
          {isStudy ? 'Study' : isEnded ? '✓ Completed' : '⏳ In progress'}
        </span>
        {isStudy && (
          <span className={`tag ${studyCategory === 'algorithm' ? 'tag-algorithm' : 'tag-topic'}`}>
            {studyCategory === 'algorithm' ? 'Algorithm' : 'Topic'}
          </span>
        )}
        {!isStudy && (
          <span className="tag tag-type">{getInterviewType(session)}</span>
        )}
        <span className="tag tag-source">{session.knowledgeSource}</span>
      </div>
    </div>
  )
}
