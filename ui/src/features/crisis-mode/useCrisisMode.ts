import { useEffect, useMemo, useState } from 'react'
import { getTopicDetails, type TopicDetails } from '../../api'
import { unlockCrisisAudio } from '../../audio/crisisAudio'
import { isPressureActive } from '../../crisis/pressureState'
import {
  buildArenaScenariosFromTopic,
  CRISIS_TOPIC_FILE,
  type ArenaAction,
  type ArenaScenario,
} from '../../crisis/topicArena'
import {
  applyMetricDelta,
  buildAttemptRecord,
  buildRoundArtifact,
  calculateInterviewReadiness,
  evaluateConceptCoverage,
  FLOATING_POINTS_DURATION_MS,
  FOLLOWUP_TIMER,
  getAttemptImprovement,
  gradePoints,
  IMPROVEMENT_BONUS,
  INITIAL_METRICS,
  OUTCOME_EFFECTS,
  STARTING_TIMER,
  shouldAwardImprovementBonus,
  type ArenaArtifact,
  type AttemptRecord,
  type HistoryEntry,
  type Metrics,
} from './model'

type FloatingTone = 'strong' | 'decent' | 'weak' | null

function resetableInterviewState() {
  return {
    interviewStarted: false,
    followupTimer: FOLLOWUP_TIMER,
    answerDraft: '',
    improvedDraft: '',
    firstAttempt: null as AttemptRecord | null,
    secondAttempt: null as AttemptRecord | null,
    twistUnlocked: false,
    twistAnswer: '',
    twistAnswered: false,
    copied: false,
  }
}

export function useCrisisMode() {
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
  const [interviewState, setInterviewState] = useState(resetableInterviewState)
  const [floatingPoints, setFloatingPoints] = useState<number | null>(null)
  const [floatingTone, setFloatingTone] = useState<FloatingTone>(null)
  const [floatingPosition, setFloatingPosition] = useState<{ top: number; left: number } | null>(null)
  const [floatingAnimationKey, setFloatingAnimationKey] = useState(0)

  const scenario = scenarios[roundIndex] ?? null
  const selectedAction = scenario?.actions.find((action) => action.id === selectedActionId) ?? null
  const bestMoveId = scenario?.actions.find((action) => action.outcome === 'strong')?.id ?? null
  const finished = roundIndex >= scenarios.length - 1 && selectedAction !== null
  const followupPrompt = scenario?.followupPrompt ?? ''
  const twistPrompt = scenario?.twistPrompt ?? ''

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
  }, [runStarted, scenario, selectedActionId])

  useEffect(() => {
    if (!runStarted || !scenario || timer !== 0 || selectedActionId) return
    void handleActionSelect(scenario.actions[0])
  }, [runStarted, scenario, timer, selectedActionId])

  useEffect(() => {
    if (!interviewState.interviewStarted || interviewState.firstAttempt) return

    const intervalId = window.setInterval(() => {
      setInterviewState((current) => {
        if (current.followupTimer <= 1) {
          window.clearInterval(intervalId)
          return { ...current, followupTimer: 0 }
        }
        return { ...current, followupTimer: current.followupTimer - 1 }
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [interviewState.interviewStarted, interviewState.firstAttempt])

  useEffect(() => {
    if (!interviewState.copied) return
    const timeoutId = window.setTimeout(() => {
      setInterviewState((current) => ({ ...current, copied: false }))
    }, 1600)
    return () => window.clearTimeout(timeoutId)
  }, [interviewState.copied])

  useEffect(() => {
    if (floatingPoints == null) return
    const timeoutId = window.setTimeout(() => {
      setFloatingPoints(null)
      setFloatingTone(null)
      setFloatingPosition(null)
    }, FLOATING_POINTS_DURATION_MS)
    return () => window.clearTimeout(timeoutId)
  }, [floatingPoints])

  const interviewReadiness = useMemo(() => calculateInterviewReadiness(metrics), [metrics])

  const firstAssessment = scenario && interviewState.firstAttempt
    ? evaluateConceptCoverage(interviewState.firstAttempt.text, scenario.expectedConcepts)
    : null
  const secondAssessment = scenario && interviewState.secondAttempt
    ? evaluateConceptCoverage(interviewState.secondAttempt.text, scenario.expectedConcepts)
    : null
  const improvementDelta = getAttemptImprovement(interviewState.firstAttempt, interviewState.secondAttempt)
  const roundGrade = interviewState.secondAttempt?.grade ?? interviewState.firstAttempt?.grade ?? null
  const improveUsed = interviewState.secondAttempt !== null
  const pressureCountdown = selectedActionId === null
    ? runStarted ? timer : null
    : interviewState.interviewStarted && interviewState.firstAttempt === null
      ? interviewState.followupTimer
      : null
  const pressureActive = isPressureActive(pressureCountdown)

  function resetInterviewState() {
    setInterviewState(resetableInterviewState())
  }

  function calculateAnswerElapsedSec() {
    return FOLLOWUP_TIMER - interviewState.followupTimer
  }

  async function handleCopyPrompt() {
    if (!followupPrompt) return
    await navigator.clipboard.writeText(followupPrompt)
    setInterviewState((current) => ({ ...current, copied: true }))
  }

  async function handleActionSelect(action: ArenaAction, position?: { top: number; left: number }) {
    if (!scenario || selectedActionId) return

    const outcomeEffect = OUTCOME_EFFECTS[action.outcome]
    const awardedDecisionPoints = outcomeEffect.score + timer
    const artifact = buildRoundArtifact(scenario, action, timer)

    if (position) setFloatingPosition(position)
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

  async function handleStartInterview() {
    await unlockCrisisAudio()
    setInterviewState((current) => ({ ...current, interviewStarted: true, copied: false }))
  }

  async function handleStartRun() {
    await unlockCrisisAudio()
    setRunStarted(true)
    setTimer(STARTING_TIMER)
  }

  function handleSubmitFirstAttempt() {
    if (!selectedAction || interviewState.answerDraft.trim().length < 40 || !scenario) return

    const attempt = buildAttemptRecord(interviewState.answerDraft, scenario.expectedConcepts, calculateAnswerElapsedSec())
    const awardedPoints = gradePoints(attempt.grade)

    setInterviewState((current) => ({
      ...current,
      firstAttempt: attempt,
      twistUnlocked: attempt.grade === 'Strong',
    }))
    setFloatingAnimationKey((current) => current + 1)
    setFloatingPoints(awardedPoints)
    setFloatingTone(attempt.grade === 'Strong' ? 'strong' : attempt.grade === 'Decent' ? 'decent' : 'weak')
    setScore((current) => current + awardedPoints + attempt.fastBonus)
  }

  function handleSubmitImprovedAnswer() {
    if (
      !selectedAction ||
      !interviewState.firstAttempt ||
      interviewState.improvedDraft.trim().length < 40 ||
      interviewState.secondAttempt ||
      !scenario
    ) return

    const attempt = buildAttemptRecord(interviewState.improvedDraft, scenario.expectedConcepts, calculateAnswerElapsedSec())
    const improvementBonus = shouldAwardImprovementBonus(interviewState.firstAttempt, attempt) ? IMPROVEMENT_BONUS : 0

    setInterviewState((current) => ({
      ...current,
      secondAttempt: attempt,
      twistUnlocked: true,
    }))
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

  return {
    loading,
    error,
    topicDetails,
    scenario,
    scenarios,
    roundIndex,
    runStarted,
    timer,
    score,
    metrics,
    selectedActionId,
    selectedAction,
    bestMoveId,
    history,
    latestArtifact,
    finished,
    followupPrompt,
    twistPrompt,
    interviewState,
    floatingPoints,
    floatingTone,
    floatingPosition,
    floatingAnimationKey,
    interviewReadiness,
    roundGrade,
    improveUsed,
    firstAssessment,
    secondAssessment,
    improvementDelta,
    pressureCountdown,
    pressureActive,
    actionHandlers: {
      setAnswerDraft: (value: string) => setInterviewState((current) => ({ ...current, answerDraft: value })),
      setImprovedDraft: (value: string) => setInterviewState((current) => ({ ...current, improvedDraft: value })),
      setTwistAnswer: (value: string) => setInterviewState((current) => ({ ...current, twistAnswer: value })),
      setTwistAnswered: (value: boolean) => setInterviewState((current) => ({ ...current, twistAnswered: value })),
      handleActionSelect,
      handleCopyPrompt,
      handleStartInterview,
      handleStartRun,
      handleSubmitFirstAttempt,
      handleSubmitImprovedAnswer,
      handleNextRound,
      handleReset,
    },
  }
}
