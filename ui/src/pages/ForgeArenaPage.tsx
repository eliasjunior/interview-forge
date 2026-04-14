import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { getTopicDetails, type TopicDetails } from '../api'
import { unlockCrisisAudio } from '../audio/crisisAudio'
import ArenaPressureTheme from '../components/ArenaPressureTheme'
import { isPressureActive } from '../crisis/pressureState'
import CrisisAudioBootstrap from '../components/CrisisAudioBootstrap'
import FailureFlashFx from '../components/FailureFlashFx'
import PressureCountdownAudio from '../components/PressureCountdownAudio'
import PressureTimeoutAudio from '../components/PressureTimeoutAudio'
import RewardBurstFx from '../components/RewardBurstFx'
import ArenaTimerStatus from '../components/ArenaTimerStatus'
import type { CrisisOutcome } from '../crisis/dataAccessTradeoffsCampaign'
import {
  buildArenaScenariosFromTopic,
  compareAttempts,
  CRISIS_TOPIC_FILE,
  getGrade,
  type ArenaAction,
  type ArenaConcept,
  type ArenaGrade,
  type ArenaScenario,
} from '../crisis/topicArena'

type MetricKey = 'latency' | 'reliability' | 'cost' | 'confidence'
type Metrics = Record<MetricKey, number>

type HistoryEntry = {
  scenario: string
  action: string
  outcome: CrisisOutcome
  score: number
}

type FollowupAssessment = {
  covered: string[]
  missed: string[]
  coverageCount: number
  coverageRatio: number
  grade: ArenaGrade
}

type AttemptRecord = {
  text: string
  coverageCount: number
  coverageRatio: number
  grade: ArenaGrade
  timeSpentSec: number
  fastBonus: number
}

type ArenaArtifact = {
  artifactType: 'crisis_round'
  topicFile: string
  topicTitle: string
  scenarioId: string
  scenarioStage: 'foundation' | 'intermediate' | 'advanced'
  sourceQuestionIndex: number
  scenarioPrompt: string
  selectedAction: string
  selectedActionLabel: string
  alternatives: string[]
  evaluation: {
    roundOutcome: CrisisOutcome
    reason: string
  }
  signals: {
    timeRemainingSec: number
    confidence?: 'low' | 'medium' | 'high'
  }
}

const STARTING_TIMER = 60
const FOLLOWUP_TIMER = 60
const FAST_RESPONSE_THRESHOLD_SEC = 22
const FAST_RESPONSE_BONUS = 5
const IMPROVEMENT_BONUS = 20
const FLOATING_POINTS_DURATION_MS = 3000

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

function evaluateConceptCoverage(answer: string, concepts: ArenaConcept[]): FollowupAssessment {
  const normalized = answer.toLowerCase()
  const covered = concepts
    .filter((concept) => concept.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())))
    .map((concept) => concept.label)
  const missed = concepts
    .map((concept) => concept.label)
    .filter((label) => !covered.includes(label))
  const coverageCount = covered.length
  const coverageRatio = concepts.length === 0 ? 0 : coverageCount / concepts.length

  return {
    covered,
    missed,
    coverageCount,
    coverageRatio,
    grade: getGrade(coverageRatio),
  }
}

function gradeBadge(grade: ArenaGrade) {
  if (grade === 'Strong') return '🟢'
  if (grade === 'Decent') return '🟡'
  return '🔴'
}

function gradePoints(grade: ArenaGrade) {
  if (grade === 'Strong') return 30
  if (grade === 'Decent') return 15
  return 5
}

export default function ForgeArenaPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [topicDetails, setTopicDetails] = useState<TopicDetails | null>(null)
  const [scenarios, setScenarios] = useState<ArenaScenario[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [runStarted, setRunStarted] = useState(false)
  const [timer, setTimer] = useState(STARTING_TIMER)
  const [score, setScore] = useState(0)
  const [metrics, setMetrics] = useState<Metrics>(INITIAL_METRICS)
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [latestArtifact, setLatestArtifact] = useState<ArenaArtifact | null>(null)

  const [interviewStarted, setInterviewStarted] = useState(false)
  const [followupTimer, setFollowupTimer] = useState(FOLLOWUP_TIMER)
  const [answerDraft, setAnswerDraft] = useState('')
  const [improvedDraft, setImprovedDraft] = useState('')
  const [firstAttempt, setFirstAttempt] = useState<AttemptRecord | null>(null)
  const [secondAttempt, setSecondAttempt] = useState<AttemptRecord | null>(null)
  const [twistUnlocked, setTwistUnlocked] = useState(false)
  const [copied, setCopied] = useState(false)
  const [floatingPoints, setFloatingPoints] = useState<number | null>(null)
  const [floatingTone, setFloatingTone] = useState<'strong' | 'decent' | 'weak' | null>(null)
  const [floatingPosition, setFloatingPosition] = useState<{ top: number; left: number } | null>(null)
  const [floatingAnimationKey, setFloatingAnimationKey] = useState(0)

  const scenario = scenarios[roundIndex] ?? null
  const selectedAction = scenario?.actions.find((action) => action.id === selectedActionId) ?? null
  const bestMoveId = scenario?.actions.find((action) => action.outcome === 'strong')?.id ?? null
  const finished = roundIndex >= scenarios.length - 1 && selectedAction !== null
  const followupPrompt = scenario?.followupPrompt ?? ''
  const twistPrompt = scenario?.twistPrompt ?? ''
  const [twistAnswer, setTwistAnswer] = useState('')
  const [twistAnswered, setTwistAnswered] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadTopicArena() {
      setLoading(true)
      setError(null)

      try {
        const details = await getTopicDetails(CRISIS_TOPIC_FILE)
        const generated = buildArenaScenariosFromTopic(details)

        if (cancelled) return

        setTopicDetails(details)
        setScenarios(generated)
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load topic-driven crisis mode.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTopicArena()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!runStarted || !scenario || selectedActionId) return

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
  }, [runStarted, roundIndex, selectedActionId, scenario])

  useEffect(() => {
    if (!runStarted || !scenario || timer !== 0 || selectedActionId) return
    void handleAction(scenario.actions[0])
  }, [runStarted, timer, selectedActionId, scenario])

  useEffect(() => {
    if (!interviewStarted || firstAttempt) return

    const intervalId = window.setInterval(() => {
      setFollowupTimer((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [interviewStarted, firstAttempt])

  useEffect(() => {
    if (!copied) return
    const timeoutId = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timeoutId)
  }, [copied])

  useEffect(() => {
    if (floatingPoints == null) return
    const timeoutId = window.setTimeout(() => {
      setFloatingPoints(null)
      setFloatingTone(null)
      setFloatingPosition(null)
    }, FLOATING_POINTS_DURATION_MS)
    return () => window.clearTimeout(timeoutId)
  }, [floatingPoints])

  const interviewReadiness = useMemo(() => {
    return Math.round((metrics.latency + metrics.reliability + metrics.confidence - metrics.cost * 0.35) / 2.65)
  }, [metrics])

  function resetInterviewState() {
    setInterviewStarted(false)
    setFollowupTimer(FOLLOWUP_TIMER)
    setAnswerDraft('')
    setImprovedDraft('')
    setFirstAttempt(null)
    setSecondAttempt(null)
    setTwistUnlocked(false)
    setTwistAnswer('')
    setTwistAnswered(false)
    setCopied(false)
  }

  function calculateAnswerTimeRemaining() {
    return FOLLOWUP_TIMER - followupTimer
  }

  function buildAttemptRecord(answer: string): AttemptRecord {
    const assessment = evaluateConceptCoverage(answer, scenario?.expectedConcepts ?? [])
    const timeSpentSec = calculateAnswerTimeRemaining()
    const fastBonus = timeSpentSec <= FAST_RESPONSE_THRESHOLD_SEC ? FAST_RESPONSE_BONUS : 0

    return {
      text: answer.trim(),
      coverageCount: assessment.coverageCount,
      coverageRatio: assessment.coverageRatio,
      grade: assessment.grade,
      timeSpentSec,
      fastBonus,
    }
  }

  async function handleCopyPrompt() {
    if (!followupPrompt) return
    await navigator.clipboard.writeText(followupPrompt)
    setCopied(true)
  }

  async function handleAction(action: ArenaAction) {
    if (!scenario || selectedActionId) return

    const outcomeEffect = OUTCOME_EFFECTS[action.outcome]
    const awardedDecisionPoints = outcomeEffect.score + timer
    const artifact: ArenaArtifact = {
      artifactType: 'crisis_round',
      topicFile: scenario.topicFile,
      topicTitle: scenario.topicTitle,
      scenarioId: scenario.id,
      scenarioStage: scenario.stage,
      sourceQuestionIndex: scenario.sourceQuestionIndex,
      scenarioPrompt: scenario.prompt,
      selectedAction: action.id,
      selectedActionLabel: action.label,
      alternatives: scenario.actions.filter((candidate) => candidate.id !== action.id).map((candidate) => candidate.id),
      evaluation: {
        roundOutcome: action.outcome,
        reason: action.rationale,
      },
      signals: {
        timeRemainingSec: timer,
        confidence: action.outcome === 'strong' ? 'high' : action.outcome === 'mixed' ? 'medium' : 'low',
      },
    }

    setSelectedActionId(action.id)
    setLatestArtifact(artifact)
    setMetrics((current) => applyMetricDelta(current, outcomeEffect.metrics))
    setFloatingAnimationKey((current) => current + 1)
    setFloatingPoints(awardedDecisionPoints)
    setFloatingTone(action.outcome === 'strong' ? 'strong' : action.outcome === 'mixed' ? 'decent' : 'weak')
    setScore((current) => current + awardedDecisionPoints)
    setHistory((current) => [
      ...current,
      {
        scenario: scenario.title,
        action: action.label,
        outcome: action.outcome,
        score: awardedDecisionPoints,
      },
    ])
    resetInterviewState()
  }

  async function handleActionClick(action: ArenaAction, event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    setFloatingPosition({
      top: rect.top + rect.height / 2 - 18,
      left: rect.right + 16,
    })
    await handleAction(action)
  }

  async function handleStartInterview() {
    await unlockCrisisAudio()
    setInterviewStarted(true)
    setCopied(false)
  }

  async function handleStartRun() {
    await unlockCrisisAudio()
    setRunStarted(true)
    setTimer(STARTING_TIMER)
  }

  function handleSubmitFirstAttempt() {
    if (!selectedAction || answerDraft.trim().length < 40) return

    const attempt = buildAttemptRecord(answerDraft)
    const awardedPoints = gradePoints(attempt.grade)
    setFirstAttempt(attempt)
    if (attempt.grade === 'Strong') setTwistUnlocked(true)
    setFloatingAnimationKey((current) => current + 1)
    setFloatingPoints(awardedPoints)
    setFloatingTone(attempt.grade === 'Strong' ? 'strong' : attempt.grade === 'Decent' ? 'decent' : 'weak')
    setScore((current) => current + attempt.fastBonus)
  }

  function handleSubmitImprovedAnswer() {
    if (!selectedAction || !firstAttempt || improvedDraft.trim().length < 40 || secondAttempt) return

    const attempt = buildAttemptRecord(improvedDraft)
    const improvementBonus = compareAttempts(firstAttempt.coverageRatio, attempt.coverageRatio) ? IMPROVEMENT_BONUS : 0

    setSecondAttempt(attempt)
    setTwistUnlocked(true)
    setScore((current) => current + attempt.fastBonus + improvementBonus)
    setMetrics((current) =>
      applyMetricDelta(current, {
        latency: 0,
        reliability: 4,
        cost: 0,
        confidence: improvementBonus > 0 ? 8 : 3,
      }),
    )
  }

  function handleNextRound() {
    if (roundIndex >= scenarios.length - 1) return
    setRoundIndex((current) => current + 1)
    setSelectedActionId(null)
    setLatestArtifact(null)
    setTimer(STARTING_TIMER)
    resetInterviewState()
  }

  async function handleReset() {
    await unlockCrisisAudio()
    if (topicDetails) {
      setScenarios(buildArenaScenariosFromTopic(topicDetails))
    }
    setRunStarted(true)
    setRoundIndex(0)
    setTimer(STARTING_TIMER)
    setScore(0)
    setMetrics(INITIAL_METRICS)
    setSelectedActionId(null)
    setLatestArtifact(null)
    setHistory([])
    resetInterviewState()
  }

  const firstAssessment = scenario && firstAttempt ? evaluateConceptCoverage(firstAttempt.text, scenario.expectedConcepts) : null
  const secondAssessment = scenario && secondAttempt ? evaluateConceptCoverage(secondAttempt.text, scenario.expectedConcepts) : null
  const improvementDelta = firstAttempt && secondAttempt ? secondAttempt.coverageCount - firstAttempt.coverageCount : 0
  const roundGrade = secondAttempt?.grade ?? firstAttempt?.grade ?? null
  const improveUsed = secondAttempt !== null
  const pressureCountdown = selectedActionId === null
    ? runStarted ? timer : null
    : interviewStarted && firstAttempt === null
      ? followupTimer
      : null
  const pressureActive = isPressureActive(pressureCountdown)

  if (loading) return <div className="page-loading">Loading Crisis Mode...</div>
  if (error || !scenario || !topicDetails) return <div className="error-msg">Failed to load Crisis Mode: {error ?? 'Missing topic data.'}</div>

  return (
    <div className="arena-page">
      <CrisisAudioBootstrap />
      <ArenaPressureTheme active={pressureActive} secondsRemaining={pressureCountdown} />
      <PressureCountdownAudio active={pressureActive} secondsRemaining={pressureCountdown} />
      <PressureTimeoutAudio armed={pressureCountdown !== null} secondsRemaining={pressureCountdown} />
      <FailureFlashFx armed={pressureCountdown !== null} secondsRemaining={pressureCountdown} />
      <RewardBurstFx
        animationKey={floatingAnimationKey}
        points={floatingPoints}
        tone={floatingTone}
        position={floatingPosition}
      />
      <div className="arena-hero card">
        <div>
          <div className="arena-eyebrow">{topicDetails.topic}</div>
          <h1 className="arena-title">Crisis Mode</h1>
          <p className="arena-subtitle">
            One topic file drives this entire challenge. The round order is shuffled, but the feedback
            comes from explicit concepts taken from the authored trade-offs in that topic.
          </p>
        </div>
        <div className="arena-hero-actions">
          <ArenaTimerStatus secondsRemaining={timer} locked={selectedAction !== null} armed={runStarted} />
          <button className="btn-secondary" onClick={runStarted ? handleReset : handleStartRun}>
            {runStarted ? 'Restart run' : 'Start run'}
          </button>
        </div>
      </div>

      <div className="arena-layout">
        <section className="arena-main">
          <div className="arena-round card">
            <div className="arena-round-header">
              <div>
                <div className="arena-round-label">
                  Round {roundIndex + 1} / {scenarios.length}
                </div>
                <h2 className="arena-round-title">{scenario.title}</h2>
              </div>
              <div className="arena-best-move-hint">{scenario.stage} stage · topic-backed drill</div>
            </div>

            {!runStarted ? (
              <div className="arena-ready-panel">
                <div className="arena-result-label">Run ready</div>
                <h3 className="arena-ready-title">Start the run to reveal this crisis</h3>
                <p className="arena-ready-copy">
                  The question, trade-off context, and decision options stay hidden until the countdown is armed.
                </p>
              </div>
            ) : (
              <>
                <p className="arena-prompt">{scenario.prompt}</p>

                <div className="arena-context-list">
                  <div className="arena-context-item">Topic file: {scenario.topicFile}</div>
                  <div className="arena-context-item">Stage: {scenario.stage}</div>
                  <div className="arena-context-item">Authored question: #{scenario.sourceQuestionIndex + 1}</div>
                </div>

                <div className="arena-actions-grid">
                  {scenario.actions.map((action) => {
                    const isSelected = selectedActionId === action.id
                    const revealBest = selectedActionId !== null && action.id === bestMoveId

                    return (
                      <button
                        key={action.id}
                        className={`arena-action-card ${isSelected ? 'selected' : ''} ${revealBest ? 'best' : ''}`}
                        onClick={(event) => void handleActionClick(action, event)}
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
              </>
            )}

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
                  <span>Concepts {scenario.expectedConcepts.map((concept) => concept.label).slice(0, 3).join(', ')}</span>
                </div>

                <div className="arena-followup-block">
                  <div className="arena-result-label">Scoped follow-up prompt</div>
                  <pre className="arena-followup-prompt">{followupPrompt}</pre>

                  {!interviewStarted ? (
                    <div className="arena-result-actions">
                      <button className="btn-secondary" onClick={handleStartInterview}>
                        Start interview from this decision
                      </button>
                      <button className="btn-secondary" onClick={() => void handleCopyPrompt()}>
                        {copied ? 'Copied prompt' : 'Copy prompt'}
                      </button>
                      {finished ? (
                        <button className="btn-secondary" onClick={handleReset}>Play again</button>
                      ) : (
                        <button className="btn-secondary" onClick={handleNextRound}>Next crisis</button>
                      )}
                    </div>
                  ) : (
                    <div className="arena-interview-flow">
                      <div className="arena-interview-head">
                        <div>
                          <div className="arena-result-label">Follow-up interview</div>
                          <h3 className="arena-interview-title">Defend your decision</h3>
                        </div>
                        <div className={`arena-mini-timer ${followupTimer <= 8 && !firstAttempt ? 'danger' : ''}`}>
                          {firstAttempt ? `Answered in ${firstAttempt.timeSpentSec}s` : `⏱ ${followupTimer}s`}
                        </div>
                      </div>

                      {!firstAttempt ? (
                        <div className="arena-interview-card">
                          <textarea
                            className="arena-answer-input"
                            value={answerDraft}
                            onChange={(event) => setAnswerDraft(event.target.value)}
                            placeholder="Answer like a candidate in a system design interview. Name the bottleneck, the trade-off, the API shape, and what you would measure next."
                          />
                          <div className="arena-result-actions">
                            <button
                              className="btn-secondary"
                              onClick={handleSubmitFirstAttempt}
                              disabled={answerDraft.trim().length < 40}
                            >
                              Submit answer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="arena-interview-stack">
                          <div className="arena-grade-card">
                            <div className="arena-grade-head">
                              <div>
                                <div className="arena-result-label">Grade shown</div>
                                <h3 className="arena-grade-score">{gradeBadge(firstAttempt.grade)} {firstAttempt.grade}</h3>
                              </div>
                              <div className="arena-grade-bonus">
                                <div>⏱ Answer time: {firstAttempt.timeSpentSec}s</div>
                                <div>⚡ Bonus: +{firstAttempt.fastBonus} (fast response)</div>
                              </div>
                            </div>
                            <div className="arena-precision-feedback">
                              <strong>{firstAttempt.grade === 'Strong' ? 'Strong' : firstAttempt.grade === 'Decent' ? 'Decent — but incomplete' : 'Weak — missing key trade-offs'}</strong>
                              <p>Covered: {(firstAssessment?.covered ?? []).join(', ') || 'none yet'}</p>
                              <p>Missed: {(firstAssessment?.missed.slice(0, 3) ?? []).join(', ') || 'none'}</p>
                            </div>
                            <div className="arena-keyword-hits">
                              {(firstAssessment?.covered ?? []).map((hit) => (
                                <span key={hit} className="arena-chip success">{hit}</span>
                              ))}
                            </div>
                          </div>

                          {firstAttempt.grade !== 'Strong' && !secondAttempt ? (
                            <div className="arena-grade-card">
                              <div className="arena-result-label">Improve your answer</div>
                              <h3 className="arena-interview-title">Improve answer (+20 pts if better)</h3>
                              <textarea
                                className="arena-answer-input"
                                value={improvedDraft}
                                onChange={(event) => setImprovedDraft(event.target.value)}
                                placeholder="Use the feedback. Tighten the trade-off explanation and address the missing piece explicitly."
                              />
                              <div className="arena-result-actions">
                                <button
                                  className="btn-secondary"
                                  onClick={handleSubmitImprovedAnswer}
                                  disabled={improvedDraft.trim().length < 40}
                                >
                                  Improve answer (+20 pts if better)
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {secondAttempt && secondAssessment ? (
                            <div className="arena-grade-card">
                              <div className="arena-grade-head">
                                <div>
                                  <div className="arena-result-label">Attempt comparison</div>
                                  <h3 className="arena-grade-score">
                                    {firstAttempt.coverageCount}/{scenario.expectedConcepts.length} → {secondAttempt.coverageCount}/{scenario.expectedConcepts.length}
                                  </h3>
                                </div>
                                <div className="arena-grade-bonus">
                                  <div>Second answer time: {secondAttempt.timeSpentSec}s</div>
                                  <div>Improvement: {improvementDelta >= 0 ? '+' : ''}{improvementDelta}</div>
                                  <div>⚡ Bonus: +{secondAttempt.fastBonus}</div>
                                  <div>🎯 Retry bonus: {compareAttempts(firstAttempt.coverageRatio, secondAttempt.coverageRatio) ? `+${IMPROVEMENT_BONUS}` : '+0'}</div>
                                </div>
                              </div>
                              <p className="arena-grade-copy">{gradeBadge(secondAttempt.grade)} {secondAttempt.grade}</p>
                              {compareAttempts(firstAttempt.coverageRatio, secondAttempt.coverageRatio) ? (
                                <p className="arena-grade-copy">+20 pts — better coverage.</p>
                              ) : (
                                <p className="arena-grade-copy">Coverage did not improve enough for the bonus.</p>
                              )}
                            </div>
                          ) : null}

                          {twistUnlocked ? (
                            <div className="arena-twist-card">
                              <div className="arena-result-label">Twist</div>
                              <h3 className="arena-interview-title">Adapt your answer</h3>
                              <p className="arena-grade-copy">{twistPrompt}</p>
                              {!twistAnswered ? (
                                <>
                                  <textarea
                                    className="arena-answer-input"
                                    value={twistAnswer}
                                    onChange={(event) => setTwistAnswer(event.target.value)}
                                    placeholder="Answer the twist in 2-4 lines."
                                  />
                                  <div className="arena-result-actions">
                                    <button
                                      className="btn-secondary"
                                      onClick={() => setTwistAnswered(true)}
                                      disabled={twistAnswer.trim().length < 20}
                                    >
                                      Submit twist answer
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <p className="arena-grade-copy">Twist answered. Round complete.</p>
                              )}
                            </div>
                          ) : null}

                          <div className="arena-result-actions">
                            <button className="btn-secondary" onClick={() => void handleCopyPrompt()}>
                              {copied ? 'Copied prompt' : 'Copy prompt'}
                            </button>
                            {finished ? (
                              <button className="btn-secondary" onClick={handleReset}>Play again</button>
                            ) : (
                              <button className="btn-secondary" onClick={handleNextRound}>Next crisis</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
                <div className="arena-readiness-label">Round progress</div>
                <div className="arena-artifact-meta">Decision: {latestArtifact.selectedActionLabel}</div>
                <div className="arena-artifact-meta">Grade: {roundGrade ? `${gradeBadge(roundGrade)} ${roundGrade}` : 'Not graded yet'}</div>
                <div className="arena-artifact-meta">
                  Concept coverage: {secondAttempt?.coverageCount ?? firstAttempt?.coverageCount ?? 0}/{scenario.expectedConcepts.length}
                </div>
                <div className="arena-artifact-meta">Improve used: {improveUsed ? 'yes' : 'no'}</div>
                <div className="arena-artifact-meta">Twist answered: {twistAnswered ? 'yes' : 'no'}</div>
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
