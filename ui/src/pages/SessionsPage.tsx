import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessions } from '../api'
import type { Session } from '../types'
import ScoreBadge from '../components/ScoreBadge'

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

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    getSessions()
      .then(data => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setSessions(sorted)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading sessions…</div>
  if (error) return <div className="error-msg">Failed to load sessions: {error}</div>

  const ended = sessions.filter(s => s.state === 'ENDED')
  const active = sessions.filter(s => s.state !== 'ENDED')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sessions</h1>
        <p className="page-subtitle">
          {ended.length} completed · {active.length} in progress
        </p>
      </div>

      {sessions.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-msg">No sessions yet. Start an interview with the MCP server.</div>
        </div>
      )}

      {active.length > 0 && (
        <>
          <h2 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 12 }}>
            In Progress
          </h2>
          <div className="sessions-grid" style={{ marginBottom: 28 }}>
            {active.map(s => (
              <SessionCard key={s.id} session={s} onClick={() => navigate(`/sessions/${s.id}`)} />
            ))}
          </div>
        </>
      )}

      {ended.length > 0 && (
        <>
          <h2 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 12 }}>
            Completed
          </h2>
          <div className="sessions-grid">
            {ended.map(s => (
              <SessionCard key={s.id} session={s} onClick={() => navigate(`/sessions/${s.id}`)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SessionCard({ session, onClick }: { session: Session; onClick: () => void }) {
  const avg = calcAvg(session)
  const isEnded = session.state === 'ENDED'

  return (
    <div className="card card-hover" onClick={onClick}>
      <div className="session-card-topic">{session.topic}</div>

      <div style={{ fontSize: '0.83rem', color: 'var(--muted)' }}>
        {formatDate(session.createdAt)}
      </div>

      <div style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--muted)' }}>
        {session.evaluations.length} of {session.questions.length} questions answered
      </div>

      <div className="session-card-meta">
        <ScoreBadge score={avg} />
        <span className={`tag ${isEnded ? 'tag-ended' : 'tag-active'}`}>
          {isEnded ? '✓ Completed' : '⏳ In progress'}
        </span>
        <span className="tag tag-source">{session.knowledgeSource}</span>
      </div>
    </div>
  )
}
