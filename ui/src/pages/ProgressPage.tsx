import { useEffect, useMemo, useState } from 'react'
import type { Session, SessionKind, SessionRewardSummary, TopicPlanPriority } from '@mock-interview/shared'
import { getSessionRewardSummary, getSessions, getTopicLevel, getTopicPlans, getTopics, type TopicLevel } from '../api'
import ScoreBadge from '../components/ScoreBadge'

type ProgressScope = 'interview' | 'warmup' | 'drill' | 'all'

const SESSION_SCOPE_OPTIONS: Array<{ value: ProgressScope; label: string }> = [
  { value: 'all', label: 'All rounds' },
  { value: 'interview', label: 'Interviews' },
  { value: 'warmup', label: 'Warm-ups' },
  { value: 'drill', label: 'Drills' },
]

const RECENT_IMPACTS_LIMIT = 16
const LATEST_WINS_LIMIT = 4
const RECENT_TIMELINE_LIMIT = 8
const VISIBLE_SCORE_STEPS = 3

type SessionImpact = {
  session: Session
  reward: SessionRewardSummary | null
  focused: boolean
  priority: TopicPlanPriority | null
}

type TopicProgressGroup = {
  topic: string
  sessions: SessionImpact[]
  latest: SessionImpact
  firstScore: string
  latestScore: string
  delta: string
  attemptCount: number
  questionCount: number
  weakCount: number
  followUpCount: number
}

type PlanHealthItem = {
  topicFile: string
  topicName: string
  priority: TopicPlanPriority
  levelData: TopicLevel
  lastSession: Session | null
  daysSinceTouch: number | null
}

export default function ProgressPage() {
  const [sessionScope, setSessionScope] = useState<ProgressScope>('all')
  const [allRecentImpacts, setAllRecentImpacts] = useState<SessionImpact[]>([])
  const [planHealth, setPlanHealth] = useState<PlanHealthItem[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([getSessions(), getTopics(), getTopicPlans()])
      .then(async ([sessions, topics, plans]) => {
        const now = new Date().toISOString()
        const topicFileByName = new Map(topics.map(topic => [topic.displayName, topic.file]))
        const topicNameByFile = new Map(topics.map(topic => [topic.file, topic.displayName]))
        const plansByFile = new Map(plans.map(plan => [plan.topic, plan]))
        const endedInterviewLikeSessions = sessions
          .filter(session => session.state === 'ENDED')
          .filter(session => (session.sessionKind ?? 'interview') !== 'study')
          .sort((a, b) => new Date(b.endedAt ?? b.createdAt).getTime() - new Date(a.endedAt ?? a.createdAt).getTime())

        const recentSessions = endedInterviewLikeSessions.slice(0, RECENT_IMPACTS_LIMIT)
        const rewards = await Promise.all(
          recentSessions.map(async session => {
            try {
              return await getSessionRewardSummary(session.id)
            } catch {
              return null
            }
          })
        )

        const focusedPlans = plans.filter(plan => plan.focused)
        const focusedTopicLevels = await Promise.all(
          focusedPlans.map(async (plan): Promise<PlanHealthItem | null> => {
            const topicName = topicNameByFile.get(plan.topic)
            if (!topicName) return null

            try {
              const levelData = await getTopicLevel(topicName)
              const lastSession = endedInterviewLikeSessions.find(session => session.topic === topicName) ?? null
              return {
                topicFile: plan.topic,
                topicName,
                priority: plan.priority,
                levelData,
                lastSession,
                daysSinceTouch: lastSession ? daysBetween(lastSession.endedAt ?? lastSession.createdAt, now) : null,
              }
            } catch {
              return null
            }
          })
        )

        if (!cancelled) {
          setUpdatedAt(now)
          setAllRecentImpacts(
            recentSessions.map((session, index) => {
              const topicFile = topicFileByName.get(session.topic)
              const plan = topicFile ? plansByFile.get(topicFile) : undefined
              return {
                session,
                reward: rewards[index],
                focused: Boolean(plan?.focused),
                priority: plan?.priority ?? null,
              }
            })
          )

          const nextPlanHealth = focusedTopicLevels.filter((item): item is PlanHealthItem => item !== null)
          nextPlanHealth.sort((a, b) => {
            const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority)
            if (priorityDiff !== 0) return priorityDiff
            if (a.levelData.progress.almostThere !== b.levelData.progress.almostThere) {
              return a.levelData.progress.almostThere ? -1 : 1
            }
            return a.topicName.localeCompare(b.topicName)
          })
          setPlanHealth(nextPlanHealth)
        }
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
  }, [])

  const filteredImpacts = useMemo(() => {
    return allRecentImpacts.filter(({ session }) => {
      const kind = session.sessionKind ?? 'interview'
      return sessionScope === 'all' || kind === sessionScope
    })
  }, [allRecentImpacts, sessionScope])

  const groupedProgress = useMemo(() => {
    const groups = new Map<string, SessionImpact[]>()
    for (const impact of filteredImpacts) {
      const key = impact.session.topic.trim().toLowerCase()
      const current = groups.get(key) ?? []
      current.push(impact)
      groups.set(key, current)
    }

    return Array.from(groups.values())
      .map(items => {
        const sessionsDescending = [...items].sort(
          (a, b) => new Date(b.session.endedAt ?? b.session.createdAt).getTime() - new Date(a.session.endedAt ?? a.session.createdAt).getTime()
        )
        const sessionsAscending = [...sessionsDescending].reverse()
        const latest = sessionsDescending[0]
        const first = sessionsAscending[0]
        const questionCount = sessionsDescending.reduce((sum, item) => sum + item.session.evaluations.length, 0)
        const weakCount = sessionsDescending.reduce(
          (sum, item) => sum + item.session.evaluations.filter(evaluation => evaluation.score <= 3).length,
          0
        )
        const followUpCount = sessionsDescending.reduce(
          (sum, item) => sum + item.session.evaluations.filter(evaluation => evaluation.needsFollowUp).length,
          0
        )

        return {
          topic: latest.session.topic,
          sessions: sessionsAscending,
          latest,
          firstScore: averageSessionScore(first.session),
          latestScore: averageSessionScore(latest.session),
          delta: formatScoreDelta(averageSessionScoreNumber(latest.session) - averageSessionScoreNumber(first.session)),
          attemptCount: sessionsDescending.length,
          questionCount,
          weakCount,
          followUpCount,
        } satisfies TopicProgressGroup
      })
      .sort(
        (a, b) =>
          new Date(b.latest.session.endedAt ?? b.latest.session.createdAt).getTime() -
          new Date(a.latest.session.endedAt ?? a.latest.session.createdAt).getTime()
      )
  }, [filteredImpacts])

  const summary = useMemo(() => {
    const sessions = filteredImpacts.map(item => item.session)
    const evaluations = sessions.flatMap(session => session.evaluations)
    const weakQuestions = evaluations.filter(evaluation => evaluation.score <= 3).length
    const followUps = evaluations.filter(evaluation => evaluation.needsFollowUp).length
    const avgScore = evaluations.length === 0
      ? 'N/A'
      : (evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / evaluations.length).toFixed(1)

    return {
      rounds: sessions.length,
      questionsAnswered: evaluations.length,
      avgScore,
      weakRate: formatRate(weakQuestions, evaluations.length),
      followUpRate: formatRate(followUps, evaluations.length),
    }
  }, [filteredImpacts])

  if (loading) return <div className="loading">Loading progress…</div>
  if (error) return <div className="error-msg">Failed to load progress: {error}</div>

  const latestWins = groupedProgress.slice(0, LATEST_WINS_LIMIT)
  const recentTimeline = groupedProgress.slice(0, RECENT_TIMELINE_LIMIT)

  return (
    <div className="progress-page">
      <div className="page-header progress-header">
        <div>
          <h1 className="page-title">Progress</h1>
          <p className="page-subtitle">
            Recent round impact, focus-plan movement, and completed interviews across interviews, warm-ups, and drills.
          </p>
        </div>
        {updatedAt && (
          <div className="progress-generated-at">
            Updated {new Date(updatedAt).toLocaleString()}
          </div>
        )}
      </div>

      <div className="progress-toolbar card">
        <div className="progress-filter-group">
          <span className="progress-filter-label">Round scope</span>
          <div className="progress-filter-row">
            {SESSION_SCOPE_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={`progress-filter-btn${sessionScope === option.value ? ' active' : ''}`}
                onClick={() => setSessionScope(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stats-row progress-stats-row">
        <StatCard label="Completed rounds" value={String(summary.rounds)} />
        <StatCard label="Questions answered" value={String(summary.questionsAnswered)} />
        <StatCard label="Average score" value={summary.avgScore} accent />
        <StatCard label="Weak-answer rate" value={summary.weakRate} />
        <StatCard label="Follow-up rate" value={summary.followUpRate} />
      </div>

      <section className="progress-latest-wins">
        <div className="progress-panel-header">
          <div>
            <h2 className="progress-panel-title">Latest Wins</h2>
            <p className="progress-panel-subtitle">The strongest progress signals from your latest finished rounds in the current scope.</p>
          </div>
        </div>
        <LatestWinsSection items={latestWins} scope={sessionScope} />
      </section>

      <section className="progress-plan-health">
        <div className="progress-panel-header">
          <div>
            <h2 className="progress-panel-title">Plan Health</h2>
            <p className="progress-panel-subtitle">Focused topics grouped by momentum, readiness, and recency so you can steer the next round.</p>
          </div>
        </div>
        <PlanHealthSection items={planHealth} />
      </section>

      <section className="progress-current-rounds">
        <div className="progress-panel-header">
          <div>
            <h2 className="progress-panel-title">Recent Completed Interviews</h2>
            <p className="progress-panel-subtitle">A compact timeline of the latest finished rounds, including warm-ups and drills when selected.</p>
          </div>
        </div>
        <RecentSessionsTimeline items={recentTimeline} scope={sessionScope} />
      </section>
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

function LatestWinsSection({ items, scope }: { items: TopicProgressGroup[]; scope: ProgressScope }) {
  if (items.length === 0) {
    return (
      <div className="card progress-panel">
        <div className="empty-state-msg">No completed rounds matched the current scope: {scopeLabel(scope)}.</div>
      </div>
    )
  }

  return (
      <div className="progress-latest-wins-grid">
      {items.map(item => {
        const { latest } = item
        const { session, reward, focused, priority } = latest
        const kind = session.sessionKind ?? 'interview'
        const levelLabel = reward ? `L${reward.previous.level} → L${reward.current.level}` : null
        return (
          <article
            key={item.topic}
            className={`card progress-panel progress-latest-win-card${reward ? ` reward-${reward.state}` : ''}`}
          >
            <div className="progress-latest-win-head">
              <div>
                <div className="progress-latest-win-topic-row">
                  <h3 className="progress-latest-win-topic">{item.topic}</h3>
                  <span className="progress-timeline-kind">{formatSessionKind(kind)}</span>
                  {focused && <span className="progress-latest-win-pill">Focus{priority ? ` · ${priority}` : ''}</span>}
                </div>
                <div className="progress-latest-win-meta">
                  <span>{new Date(session.endedAt ?? session.createdAt).toLocaleDateString()}</span>
                  <span>{item.attemptCount} round{item.attemptCount === 1 ? '' : 's'}</span>
                  <span>{item.questionCount} questions</span>
                </div>
              </div>
              <div className="progress-latest-win-score-block">
                <ScoreBadge score={item.latestScore} />
                {item.attemptCount > 1 && (
                  <span className={`progress-latest-win-delta ${deltaClass(item.delta)}`}>{item.delta}</span>
                )}
              </div>
            </div>

            <div className="progress-latest-win-body">
              <div className="progress-latest-win-title">{reward?.title ?? 'Completed round'}</div>
              <div className="progress-latest-win-message">{reward?.message ?? 'This session finished successfully.'}</div>
              <ProgressRun scores={item.sessions.map(entry => averageSessionScore(entry.session)).slice(-VISIBLE_SCORE_STEPS)} />
              {reward && (
                <div className="reward-summary-progress">
                  <span>Before: {reward.previous.progress.label}</span>
                  <span>Now: {reward.current.progress.label}</span>
                  {levelLabel && <span>{levelLabel}</span>}
                </div>
              )}
              {reward?.nextHint && (
                <div className="reward-summary-next">{reward.nextHint}</div>
              )}
              {reward?.whyNoProgress && (
                <div className="reward-summary-why">{reward.whyNoProgress}</div>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function PlanHealthSection({ items }: { items: PlanHealthItem[] }) {
  if (items.length === 0) {
    return <div className="card progress-panel"><div className="empty-state-msg">Focus topics on the Topics page to track plan health here.</div></div>
  }

  const groups = [
    {
      key: 'almost-there',
      title: 'Almost There',
      subtitle: 'Focused topics that are one strong pass away from the next rung.',
      items: items.filter(item => item.levelData.progress.almostThere),
    },
    {
      key: 'moving-now',
      title: 'Moving Now',
      subtitle: 'Focused topics with active ladder progress and no immediate blockage.',
      items: items.filter(item =>
        !item.levelData.progress.almostThere &&
        item.levelData.status !== 'dropped' &&
        item.levelData.progress.attempted &&
        item.levelData.progress.current > 0
      ),
    },
    {
      key: 'stalled',
      title: 'Stalled',
      subtitle: 'Focused topics that need reinforcement before they move again.',
      items: items.filter(item =>
        item.levelData.status === 'dropped' ||
        (item.levelData.progress.attempted && item.levelData.progress.current === 0)
      ),
    },
    {
      key: 'untouched',
      title: 'Untouched Recently',
      subtitle: 'Focused topics that have not been revisited in the last two weeks.',
      items: items.filter(item => item.daysSinceTouch === null || item.daysSinceTouch >= 14),
    },
  ].filter(group => group.items.length > 0)

  return (
    <div className="progress-plan-groups">
      {groups.map(group => (
        <section key={group.key} className="card progress-panel">
          <div className="progress-panel-header compact">
            <div>
              <h3 className="progress-panel-title">{group.title}</h3>
              <p className="progress-panel-subtitle">{group.subtitle}</p>
            </div>
          </div>
          <div className="progress-plan-list">
            {group.items.map(item => (
              <div key={`${group.key}-${item.topicFile}`} className="progress-plan-card">
                <div className="progress-plan-card-head">
                  <div>
                    <div className="progress-plan-card-topic-row">
                      <strong>{item.topicName}</strong>
                      <span className={`progress-plan-priority-badge priority-${item.priority}`}>{item.priority}</span>
                    </div>
                    <div className="progress-plan-card-meta">
                      <span>L{item.levelData.level}</span>
                      <span>{item.levelData.progress.label}</span>
                      <span>{item.daysSinceTouch === null ? 'No finished rounds yet' : `${item.daysSinceTouch}d since last round`}</span>
                    </div>
                  </div>
                  <span className={`progress-plan-state-pill state-${planStateClass(item)}`}>{planStateLabel(item)}</span>
                </div>
                <div className="progress-plan-card-summary">
                  {item.levelData.progress.almostThere && (
                    <span className="progress-plan-mini-note">Almost there</span>
                  )}
                  {item.levelData.status === 'dropped' && (
                    <span className="progress-plan-mini-note warning">Needs reinforcement</span>
                  )}
                  {(item.daysSinceTouch === null || item.daysSinceTouch >= 14) && (
                    <span className="progress-plan-mini-note warning">Untouched recently</span>
                  )}
                  {item.lastSession && (
                    <span className="progress-plan-mini-note">Last score {averageSessionScore(item.lastSession)}/5</span>
                  )}
                </div>
                {showPlanWarning(item) && planWarningText(item) && (
                  <div className="progress-plan-card-message">
                    {planWarningText(item)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function RecentSessionsTimeline({ items, scope }: { items: TopicProgressGroup[]; scope: ProgressScope }) {
  if (items.length === 0) {
    return (
      <div className="card progress-panel">
        <div className="empty-state-msg">No finished rounds matched the current scope: {scopeLabel(scope)}.</div>
      </div>
    )
  }

  return (
    <div className="progress-timeline">
      {items.map(item => {
        const { latest } = item
        const { session, reward, focused, priority } = latest

        return (
          <article key={item.topic} className="progress-timeline-card">
            <div className="progress-timeline-rail" aria-hidden="true">
              <span className="progress-timeline-dot" />
            </div>
            <div className="progress-timeline-body">
              <div className="progress-timeline-head">
                <div>
                  <div className="progress-timeline-topic-row">
                    <strong>{item.topic}</strong>
                    <span className="progress-timeline-kind">{formatSessionKind(session.sessionKind ?? 'interview')}</span>
                    {focused && <span className="progress-latest-win-pill">Focus{priority ? ` · ${priority}` : ''}</span>}
                  </div>
                  <div className="progress-timeline-date">
                    {new Date(session.endedAt ?? session.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="progress-latest-win-score-block">
                  <ScoreBadge score={item.latestScore} />
                  {item.attemptCount > 1 && (
                    <span className={`progress-latest-win-delta ${deltaClass(item.delta)}`}>{item.delta}</span>
                  )}
                </div>
              </div>

              <div className="progress-timeline-summary">
                {reward?.message ?? defaultRecentSummary(item.weakCount, item.followUpCount)}
              </div>

              <ProgressRun scores={item.sessions.map(entry => averageSessionScore(entry.session)).slice(-VISIBLE_SCORE_STEPS)} />

              <div className="progress-timeline-meta">
                <span>{item.attemptCount} round{item.attemptCount === 1 ? '' : 's'}</span>
                <span>{item.questionCount} questions</span>
                <span>{item.weakCount} weak</span>
                <span>{item.followUpCount} follow-up{item.followUpCount === 1 ? '' : 's'}</span>
              </div>

              {reward?.nextHint && (
                <div className="progress-timeline-next">
                  {reward.nextHint}
                </div>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function ProgressRun({ scores }: { scores: string[] }) {
  return (
    <div className="progress-run">
      {scores.map((score, index) => (
        <div key={`${score}-${index}`} className="progress-run-step">
          <span className={`progress-run-badge ${scoreBadgeTone(score)}`}>{score === 'N/A' ? 'N/A' : `${score}/5`}</span>
          {index < scores.length - 1 && <span className="progress-run-arrow">→</span>}
        </div>
      ))}
    </div>
  )
}

function averageSessionScore(session: Session): string {
  if (session.evaluations.length === 0) return 'N/A'
  return (session.evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / session.evaluations.length).toFixed(1)
}

function averageSessionScoreNumber(session: Session): number {
  if (session.evaluations.length === 0) return 0
  return session.evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / session.evaluations.length
}

function defaultRecentSummary(weakCount: number, followUpCount: number): string {
  if (weakCount === 0) return 'Strong round with no weak answers in the default threshold.'
  if (followUpCount > 0) return `This round exposed ${followUpCount} follow-up area${followUpCount === 1 ? '' : 's'} worth revisiting.`
  return `This round surfaced ${weakCount} weak answer${weakCount === 1 ? '' : 's'} to reinforce.`
}

function formatSessionKind(kind: SessionKind): string {
  if (kind === 'warmup') return 'Warm-up'
  if (kind === 'drill') return 'Drill'
  if (kind === 'study') return 'Study'
  return 'Interview'
}

function scopeLabel(scope: ProgressScope): string {
  if (scope === 'all') return 'All rounds'
  if (scope === 'warmup') return 'Warm-ups'
  if (scope === 'drill') return 'Drills'
  return 'Interviews'
}

function priorityRank(priority: TopicPlanPriority): number {
  if (priority === 'core') return 0
  if (priority === 'secondary') return 1
  return 2
}

function daysBetween(from: string, to: string): number {
  const diff = new Date(to).getTime() - new Date(from).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function formatRate(count: number, total: number): string {
  if (total === 0) return '0.0%'
  return `${((count / total) * 100).toFixed(1)}%`
}

function formatScoreDelta(value: number): string {
  const rounded = value.toFixed(1)
  return value > 0 ? `+${rounded}` : rounded
}

function planStateLabel(item: PlanHealthItem): string {
  if (item.levelData.progress.almostThere) return 'Almost there'
  if (item.levelData.status === 'dropped') return 'Needs reset'
  if (item.daysSinceTouch === null || item.daysSinceTouch >= 14) return 'Cold'
  if (item.levelData.progress.attempted && item.levelData.progress.current > 0) return 'Moving'
  return 'Waiting'
}

function planStateClass(item: PlanHealthItem): string {
  if (item.levelData.progress.almostThere) return 'almost-there'
  if (item.levelData.status === 'dropped') return 'stalled'
  if (item.daysSinceTouch === null || item.daysSinceTouch >= 14) return 'cold'
  if (item.levelData.progress.attempted && item.levelData.progress.current > 0) return 'moving'
  return 'waiting'
}

function showPlanWarning(item: PlanHealthItem): boolean {
  return item.levelData.status === 'dropped'
}

function planWarningText(item: PlanHealthItem): string {
  if (item.levelData.status === 'dropped') return 'Recent full interview performance indicates this topic needs reinforcement.'
  return ''
}

function deltaClass(value: string): string {
  if (value.startsWith('+')) return 'progress-delta positive'
  if (value.startsWith('-')) return 'progress-delta negative'
  return 'progress-delta neutral'
}

function scoreBadgeTone(score: string): string {
  const value = Number(score)
  if (Number.isNaN(value)) return 'neutral'
  if (value >= 4) return 'good'
  if (value >= 3) return 'mid'
  return 'bad'
}
