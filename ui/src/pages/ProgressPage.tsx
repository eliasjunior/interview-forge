import { useEffect, useMemo, useState } from 'react'
import type { ProgressOverview, ProgressSessionKind } from '@mock-interview/shared'
import { getProgressOverview } from '../api'
import ScoreBadge from '../components/ScoreBadge'

const SESSION_KIND_OPTIONS: Array<{ value: ProgressSessionKind; label: string }> = [
  { value: 'interview', label: 'Interviews' },
  { value: 'study', label: 'Study' },
  { value: 'drill', label: 'Drills' },
  { value: 'all', label: 'Everything' },
]

const WEAK_THRESHOLDS = [2, 3, 4] as const

export default function ProgressPage() {
  const [sessionKind, setSessionKind] = useState<ProgressSessionKind>('interview')
  const [weakScoreThreshold, setWeakScoreThreshold] = useState<2 | 3 | 4>(3)
  const [data, setData] = useState<ProgressOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getProgressOverview({
      sessionKind,
      weakScoreThreshold,
      recentSessionsLimit: 6,
      topicLimit: 10,
    })
      .then(next => {
        if (!cancelled) setData(next)
      })
      .catch(err => {
        if (!cancelled) setError(String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sessionKind, weakScoreThreshold])

  const weakAreas = useMemo(() => {
    return [...(data?.topicBreakdown ?? [])]
      .sort((a, b) => {
        const weakDiff = parsePercent(b.weakQuestionRate) - parsePercent(a.weakQuestionRate)
        if (weakDiff !== 0) return weakDiff
        return Number(a.avgScore) - Number(b.avgScore)
      })
      .slice(0, 6)
  }, [data])

  if (loading) return <div className="loading">Loading progress…</div>
  if (error) return <div className="error-msg">Failed to load progress: {error}</div>
  if (!data) return <div className="error-msg">No progress data available.</div>

  return (
    <div className="progress-page">
      <div className="page-header progress-header">
        <div>
          <h1 className="page-title">Progress</h1>
          <p className="page-subtitle">
            Cross-session score trend, topic progress, and weak-area patterns from ended sessions.
          </p>
        </div>
        <div className="progress-generated-at">
          Updated {new Date(data.generatedAt).toLocaleString()}
        </div>
      </div>

      <div className="progress-toolbar card">
        <div className="progress-filter-group">
          <span className="progress-filter-label">Session scope</span>
          <div className="progress-filter-row">
            {SESSION_KIND_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={`progress-filter-btn${sessionKind === option.value ? ' active' : ''}`}
                onClick={() => setSessionKind(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="progress-filter-group">
          <span className="progress-filter-label">Weak threshold</span>
          <div className="progress-filter-row">
            {WEAK_THRESHOLDS.map(value => (
              <button
                key={value}
                type="button"
                className={`progress-filter-btn${weakScoreThreshold === value ? ' active' : ''}`}
                onClick={() => setWeakScoreThreshold(value)}
              >
                ≤ {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stats-row progress-stats-row">
        <StatCard label="Ended sessions" value={String(data.totals.sessions)} />
        <StatCard label="Questions answered" value={String(data.totals.questionsAnswered)} />
        <StatCard label="Average score" value={data.totals.avgScore} accent />
        <StatCard label="Weak-question rate" value={data.totals.weakQuestionRate} />
        <StatCard label="Follow-up rate" value={data.totals.followUpRate} />
      </div>

      <div className="progress-layout-grid">
        <section className="card progress-panel progress-panel-wide">
          <div className="progress-panel-header">
            <div>
              <h2 className="progress-panel-title">Score Trend</h2>
              <p className="progress-panel-subtitle">Average score by ended session, in chronological order.</p>
            </div>
            <ScoreBadge score={data.totals.avgScore} size="lg" />
          </div>
          <ScoreTrendChart points={data.scoreTrend} />
        </section>

        <section className="card progress-panel">
          <div className="progress-panel-header compact">
            <div>
              <h2 className="progress-panel-title">Score Distribution</h2>
              <p className="progress-panel-subtitle">How often each score appears across the selected sessions.</p>
            </div>
          </div>
          <ScoreDistribution distribution={data.scoreDistribution} />
        </section>

        <section className="card progress-panel progress-panel-wide">
          <div className="progress-panel-header compact">
            <div>
              <h2 className="progress-panel-title">Topic Progress</h2>
              <p className="progress-panel-subtitle">Average score, latest result, and weak-question rate by topic.</p>
            </div>
          </div>
          <TopicBreakdownTable rows={data.topicBreakdown} />
        </section>

        <section className="card progress-panel">
          <div className="progress-panel-header compact">
            <div>
              <h2 className="progress-panel-title">Weak Areas</h2>
              <p className="progress-panel-subtitle">Topics with the highest weak-question rate.</p>
            </div>
          </div>
          <WeakAreasChart rows={weakAreas} />
        </section>

        <section className="card progress-panel">
          <div className="progress-panel-header compact">
            <div>
              <h2 className="progress-panel-title">Repeated Topics</h2>
              <p className="progress-panel-subtitle">Improvement from first session to latest session on revisited topics.</p>
            </div>
          </div>
          <RepeatedTopicsList items={data.repeatedTopics} />
        </section>

        <section className="card progress-panel">
          <div className="progress-panel-header compact">
            <div>
              <h2 className="progress-panel-title">Recent Sessions</h2>
              <p className="progress-panel-subtitle">Most recent ended sessions included in this snapshot.</p>
            </div>
          </div>
          <RecentSessionsList items={data.recentSessions} />
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stat-card progress-stat-card">
      <div className={`stat-value${accent ? ' progress-stat-value-accent' : ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function ScoreTrendChart({ points }: { points: ProgressOverview['scoreTrend'] }) {
  if (points.length === 0) {
    return <div className="empty-state-msg">No ended sessions matched the current filter.</div>
  }

  const width = 760
  const height = 240
  const left = 24
  const right = 18
  const top = 18
  const bottom = 36
  const innerWidth = width - left - right
  const innerHeight = height - top - bottom

  const values = points.map(point => Number(point.avgScore))
  const min = Math.min(0, ...values)
  const max = Math.max(5, ...values)

  const x = (index: number) => left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth)
  const y = (value: number) => top + (max - value) / (max - min || 1) * innerHeight
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(Number(point.avgScore))}`).join(' ')

  return (
    <div className="progress-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="progress-chart" role="img" aria-label="Score trend chart">
        {[1, 2, 3, 4, 5].map(mark => (
          <g key={mark}>
            <line x1={left} x2={width - right} y1={y(mark)} y2={y(mark)} className="progress-grid-line" />
            <text x={4} y={y(mark) + 4} className="progress-axis-label">{mark.toFixed(1)}</text>
          </g>
        ))}
        <path d={path} className="progress-line-path" />
        {points.map((point, index) => {
          const cx = x(index)
          const cy = y(Number(point.avgScore))
          return (
            <g key={point.sessionId}>
              <circle cx={cx} cy={cy} r={5} className="progress-line-dot" />
              <title>{`${point.topic} · ${point.avgScore}/5 · ${new Date(point.endedAt).toLocaleDateString()}`}</title>
            </g>
          )
        })}
      </svg>
      <div className="progress-chart-footnote">
        {points.map(point => (
          <div key={point.sessionId} className="progress-chart-footnote-item">
            <strong>{point.avgScore}</strong>
            <span>{point.topic}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScoreDistribution({ distribution }: { distribution: ProgressOverview['scoreDistribution'] }) {
  const total = Object.values(distribution).reduce((sum, value) => sum + value, 0)

  return (
    <div className="progress-bars">
      {Object.entries(distribution).map(([score, count]) => {
        const percent = total === 0 ? 0 : (count / total) * 100
        return (
          <div key={score} className="progress-bar-row">
            <div className="progress-bar-label">Score {score}</div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="progress-bar-value">{count}</div>
          </div>
        )
      })}
    </div>
  )
}

function TopicBreakdownTable({ rows }: { rows: ProgressOverview['topicBreakdown'] }) {
  if (rows.length === 0) {
    return <div className="empty-state-msg">No topic history yet for this filter.</div>
  }

  return (
    <div className="progress-table-wrap">
      <table className="progress-table">
        <thead>
          <tr>
            <th>Topic</th>
            <th>Sessions</th>
            <th>Avg</th>
            <th>Latest</th>
            <th>Delta</th>
            <th>Weak rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.topic}>
              <td>
                <div className="progress-topic-cell">
                  <strong>{row.topic}</strong>
                  <span>{row.totalQuestions} questions</span>
                </div>
              </td>
              <td>{row.sessionCount}</td>
              <td>{row.avgScore}</td>
              <td>{row.latestScore}</td>
              <td className={deltaClass(row.deltaFromFirst)}>{row.deltaFromFirst}</td>
              <td>{row.weakQuestionRate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WeakAreasChart({ rows }: { rows: ProgressOverview['topicBreakdown'] }) {
  if (rows.length === 0) {
    return <div className="empty-state-msg">No weak areas yet for this filter.</div>
  }

  return (
    <div className="progress-bars weak-areas-bars">
      {rows.map(row => (
        <div key={row.topic} className="progress-bar-row verticalish">
          <div className="progress-bar-topic-block">
            <strong>{row.topic}</strong>
            <span>{row.weakQuestions} weak / {row.totalQuestions}</span>
          </div>
          <div className="progress-bar-track warm">
            <div className="progress-bar-fill warm" style={{ width: row.weakQuestionRate }} />
          </div>
          <div className="progress-bar-value">{row.weakQuestionRate}</div>
        </div>
      ))}
    </div>
  )
}

function RepeatedTopicsList({ items }: { items: ProgressOverview['repeatedTopics'] }) {
  if (items.length === 0) {
    return <div className="empty-state-msg">Repeat a topic in a later session to see improvement here.</div>
  }

  return (
    <div className="progress-stack-list">
      {items.map(item => (
        <div key={item.topic} className="progress-stack-card">
          <div className="progress-stack-head">
            <strong>{item.topic}</strong>
            <span className={deltaClass(item.delta)}>{item.delta}</span>
          </div>
          <div className="progress-stack-meta">
            <span>{item.firstScore} → {item.latestScore}</span>
            <span>{item.sessionCount} sessions</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function RecentSessionsList({ items }: { items: ProgressOverview['recentSessions'] }) {
  if (items.length === 0) {
    return <div className="empty-state-msg">No recent sessions matched the current filter.</div>
  }

  return (
    <div className="progress-stack-list">
      {items.map(item => (
        <div key={item.sessionId} className="progress-stack-card">
          <div className="progress-stack-head">
            <strong>{item.topic}</strong>
            <ScoreBadge score={item.avgScore} />
          </div>
          <div className="progress-stack-meta">
            <span>{new Date(item.endedAt ?? item.createdAt).toLocaleDateString()}</span>
            <span>{item.questionCount} questions</span>
            <span>{item.weakQuestionCount} weak</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function parsePercent(value: string): number {
  return Number(value.replace('%', ''))
}

function deltaClass(value: string): string {
  if (value.startsWith('+')) return 'progress-delta positive'
  if (value.startsWith('-')) return 'progress-delta negative'
  return 'progress-delta neutral'
}
