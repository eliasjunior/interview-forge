import { useEffect, useMemo, useState } from 'react'
import {
  buildCrisisRoundArtifact,
  buildDataAccessFollowupPrompt,
  dataAccessTradeoffsCampaign,
  type CrisisAction,
  type CrisisOutcome,
  type CrisisRoundArtifact,
} from '../crisis/dataAccessTradeoffsCampaign'

type MetricKey = 'latency' | 'reliability' | 'cost' | 'confidence'
type Metrics = Record<MetricKey, number>

type HistoryEntry = {
  scenario: string
  action: string
  outcome: CrisisOutcome
  score: number
}

const STARTING_TIMER = 35

const INITIAL_METRICS: Metrics = {
  latency: 52,
  reliability: 61,
  cost: 40,
  confidence: 45,
}

const OUTCOME_EFFECTS: Record<CrisisOutcome, { score: number; metrics: Metrics }> = {
  strong: {
    score: 140,
    metrics: { latency: 16, reliability: 12, cost: 4, confidence: 11 },
  },
  mixed: {
    score: 85,
    metrics: { latency: 6, reliability: 3, cost: 8, confidence: 2 },
  },
  weak: {
    score: 45,
    metrics: { latency: -5, reliability: -7, cost: 10, confidence: -8 },
  },
}

const OUTCOME_LABELS: Record<CrisisOutcome, string> = {
  strong: 'Strong first move',
  mixed: 'Partial move',
  weak: 'Missed first move',
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value))
}

function applyMetricDelta(metrics: Metrics, delta: Metrics): Metrics {
  return {
    latency: clamp(metrics.latency + delta.latency),
    reliability: clamp(metrics.reliability + delta.reliability),
    cost: clamp(metrics.cost + delta.cost),
    confidence: clamp(metrics.confidence + delta.confidence),
  }
}

function getHealthLabel(value: number) {
  if (value >= 80) return 'Strong'
  if (value >= 60) return 'Stable'
  if (value >= 40) return 'Shaky'
  return 'Critical'
}

function getOutcomeTone(outcome: CrisisOutcome) {
  if (outcome === 'strong') return 'success'
  if (outcome === 'mixed') return 'mixed'
  return 'danger'
}

export default function ForgeArenaPage() {
  const [roundIndex, setRoundIndex] = useState(0)
  const [timer, setTimer] = useState(STARTING_TIMER)
  const [score, setScore] = useState(0)
  const [metrics, setMetrics] = useState<Metrics>(INITIAL_METRICS)
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [latestArtifact, setLatestArtifact] = useState<CrisisRoundArtifact | null>(null)
  const [copied, setCopied] = useState(false)

  const scenario = dataAccessTradeoffsCampaign[roundIndex]
  const selectedAction = scenario.actions.find((action) => action.id === selectedActionId) ?? null
  const bestMoveId = scenario.actions.find((action) => action.outcome === 'strong')?.id ?? null
  const finished = roundIndex >= dataAccessTradeoffsCampaign.length - 1 && selectedAction !== null
  const followupPrompt = latestArtifact ? buildDataAccessFollowupPrompt(latestArtifact) : ''

  useEffect(() => {
    if (selectedActionId) return

    const intervalId = window.setInterval(() => {
      setTimer((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [roundIndex, selectedActionId])

  useEffect(() => {
    if (timer !== 0 || selectedActionId) return
    void handleAction(scenario.actions[0])
  }, [timer, selectedActionId, scenario])

  useEffect(() => {
    if (!copied) return
    const timeoutId = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timeoutId)
  }, [copied])

  const interviewReadiness = useMemo(() => {
    return Math.round((metrics.latency + metrics.reliability + metrics.confidence - metrics.cost * 0.35) / 2.65)
  }, [metrics])

  async function handleCopyPrompt() {
    if (!followupPrompt) return
    await navigator.clipboard.writeText(followupPrompt)
    setCopied(true)
  }

  async function handleAction(action: CrisisAction) {
    if (selectedActionId) return

    const outcomeEffect = OUTCOME_EFFECTS[action.outcome]
    const artifact = buildCrisisRoundArtifact({
      scenario,
      selectedActionId: action.id,
      timeRemainingSec: timer,
      confidence: action.outcome === 'strong' ? 'high' : action.outcome === 'mixed' ? 'medium' : 'low',
    })

    setSelectedActionId(action.id)
    setLatestArtifact(artifact)
    setMetrics((current) => applyMetricDelta(current, outcomeEffect.metrics))
    setScore((current) => current + outcomeEffect.score + timer)
    setHistory((current) => [
      ...current,
      {
        scenario: scenario.title,
        action: action.label,
        outcome: action.outcome,
        score: outcomeEffect.score + timer,
      },
    ])
  }

  function handleNextRound() {
    if (roundIndex >= dataAccessTradeoffsCampaign.length - 1) return
    setRoundIndex((current) => current + 1)
    setSelectedActionId(null)
    setLatestArtifact(null)
    setCopied(false)
    setTimer(STARTING_TIMER)
  }

  function handleReset() {
    setRoundIndex(0)
    setTimer(STARTING_TIMER)
    setScore(0)
    setMetrics(INITIAL_METRICS)
    setSelectedActionId(null)
    setLatestArtifact(null)
    setCopied(false)
    setHistory([])
  }

  return (
    <div className="arena-page">
      <div className="arena-hero card">
        <div>
          <div className="arena-eyebrow">Data Access Campaign</div>
          <h1 className="arena-title">Crisis Mode</h1>
          <p className="arena-subtitle">
            The page now runs the shared data-access trade-offs campaign. Each choice creates a
            reusable round artifact and a scoped follow-up interview prompt.
          </p>
        </div>
        <div className="arena-hero-actions">
          <div className={`arena-timer ${timer <= 10 && !selectedAction ? 'danger' : ''}`}>
            {selectedAction ? 'Locked' : `${timer}s`}
          </div>
          <button className="btn-secondary" onClick={handleReset}>Restart run</button>
        </div>
      </div>

      <div className="arena-layout">
        <section className="arena-main">
          <div className="arena-round card">
            <div className="arena-round-header">
              <div>
                <div className="arena-round-label">
                  Round {roundIndex + 1} / {dataAccessTradeoffsCampaign.length}
                </div>
                <h2 className="arena-round-title">{scenario.title}</h2>
              </div>
              <div className="arena-best-move-hint">{scenario.stage} stage · topic-backed drill</div>
            </div>

            <p className="arena-prompt">{scenario.prompt}</p>

            <div className="arena-context-list">
              <div className="arena-context-item">Topic file: {scenario.topicFile}</div>
              <div className="arena-context-item">Stage: {scenario.stage}</div>
              {scenario.sourceQuestionHint ? (
                <div className="arena-context-item">Source question hint: #{scenario.sourceQuestionHint}</div>
              ) : null}
            </div>

            <div className="arena-actions-grid">
              {scenario.actions.map((action) => {
                const isSelected = selectedActionId === action.id
                const revealBest = selectedActionId !== null && action.id === bestMoveId

                return (
                  <button
                    key={action.id}
                    className={`arena-action-card ${isSelected ? 'selected' : ''} ${revealBest ? 'best' : ''}`}
                    onClick={() => void handleAction(action)}
                    disabled={selectedActionId !== null}
                  >
                    <div className="arena-action-top">
                      <span className="arena-action-name">{action.label}</span>
                      {isSelected ? (
                        <span className={`arena-chip ${getOutcomeTone(action.outcome)}`}>{OUTCOME_LABELS[action.outcome]}</span>
                      ) : null}
                      {!isSelected && revealBest ? <span className="arena-chip success">Best first move</span> : null}
                    </div>
                    <div className="arena-action-rationale">{action.rationale}</div>
                  </button>
                )
              })}
            </div>

            {selectedAction && latestArtifact ? (
              <div className="arena-result-panel">
                <div className="arena-result-header">
                  <div>
                    <div className="arena-result-label">Round feedback</div>
                    <h3>{OUTCOME_LABELS[selectedAction.outcome]}</h3>
                  </div>
                  <div className="arena-score-burst">+{OUTCOME_EFFECTS[selectedAction.outcome].score + timer} pts</div>
                </div>

                <p className="arena-result-copy">{latestArtifact.evaluation.reason}</p>

                <div className="arena-effect-list">
                  <span>Outcome {latestArtifact.evaluation.roundOutcome}</span>
                  <span>Time left {latestArtifact.signals.timeRemainingSec}s</span>
                  <span>Confidence {latestArtifact.signals.confidence ?? 'unknown'}</span>
                  <span>Concepts {latestArtifact.conceptsExercised.join(', ')}</span>
                </div>

                <div className="arena-followup-block">
                  <div className="arena-result-label">Scoped follow-up prompt</div>
                  <pre className="arena-followup-prompt">{followupPrompt}</pre>
                  <div className="arena-result-actions">
                    <button className="btn-secondary" onClick={() => void handleCopyPrompt()}>
                      {copied ? 'Copied prompt' : 'Copy follow-up prompt'}
                    </button>
                    {finished ? (
                      <button className="btn-secondary" onClick={handleReset}>Play again</button>
                    ) : (
                      <button className="btn-secondary" onClick={handleNextRound}>Next crisis</button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="arena-sidebar">
          <div className="arena-scoreboard card">
            <div className="arena-scoreboard-title">Run status</div>
            <div className="arena-big-score">{score}</div>
            <div className="arena-big-score-label">Total score</div>

            <div className="arena-metrics">
              {([
                ['latency', 'Latency'],
                ['reliability', 'Reliability'],
                ['cost', 'Cost control'],
                ['confidence', 'Interview confidence'],
              ] as const).map(([key, label]) => (
                <div key={key} className="arena-metric-row">
                  <div className="arena-metric-meta">
                    <span>{label}</span>
                    <strong>{metrics[key]}</strong>
                  </div>
                  <div className="arena-metric-track">
                    <div className="arena-metric-fill" style={{ width: `${metrics[key]}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="arena-readiness-box">
              <div className="arena-readiness-label">Panel read</div>
              <div className="arena-readiness-score">{interviewReadiness}</div>
              <div className="arena-readiness-copy">{getHealthLabel(interviewReadiness)} design signal</div>
            </div>

            {latestArtifact ? (
              <div className="arena-artifact-box">
                <div className="arena-readiness-label">Round artifact</div>
                <div className="arena-artifact-meta">{latestArtifact.scenarioId}</div>
                <div className="arena-artifact-meta">{latestArtifact.topicFile}</div>
                <div className="arena-artifact-meta">Alternatives: {latestArtifact.alternatives.join(', ')}</div>
              </div>
            ) : null}
          </div>

          <div className="arena-history card">
            <div className="arena-scoreboard-title">Decision trail</div>
            {history.length === 0 ? (
              <div className="arena-history-empty">Your round choices will stack here.</div>
            ) : (
              <div className="arena-history-list">
                {history.map((entry, index) => (
                  <div key={`${entry.scenario}-${index}`} className="arena-history-item">
                    <div className="arena-history-step">R{index + 1}</div>
                    <div>
                      <div className="arena-history-scenario">{entry.scenario}</div>
                      <div className="arena-history-action">{entry.action}</div>
                      <div className="arena-history-action">{OUTCOME_LABELS[entry.outcome]}</div>
                    </div>
                    <div className="arena-history-score">+{entry.score}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
