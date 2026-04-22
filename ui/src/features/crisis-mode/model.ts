import type { TopicDetails } from '../../api'
import type { CrisisOutcome } from '../../crisis/dataAccessTradeoffsCampaign'
import { compareAttempts, getGrade, type ArenaAction, type ArenaConcept, type ArenaGrade, type ArenaScenario } from '../../crisis/topicArena'

export type MetricKey = 'latency' | 'reliability' | 'cost' | 'confidence'
export type Metrics = Record<MetricKey, number>

export type HistoryEntry = {
  scenario: string
  action: string
  outcome: CrisisOutcome
  score: number
}

export type FollowupAssessment = {
  covered: string[]
  missed: string[]
  coverageCount: number
  coverageRatio: number
  grade: ArenaGrade
}

export type AttemptRecord = {
  text: string
  coverageCount: number
  coverageRatio: number
  grade: ArenaGrade
  timeSpentSec: number
  fastBonus: number
}

export type ArenaArtifact = {
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

export const STARTING_TIMER = 60
export const FOLLOWUP_TIMER = 60
export const FAST_RESPONSE_THRESHOLD_SEC = 22
export const FAST_RESPONSE_BONUS = 5
export const IMPROVEMENT_BONUS = 20
export const FLOATING_POINTS_DURATION_MS = 3000

export const INITIAL_METRICS: Metrics = {
  latency: 52,
  reliability: 61,
  cost: 40,
  confidence: 45,
}

export const OUTCOME_EFFECTS: Record<CrisisOutcome, { score: number; metrics: Metrics }> = {
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

export const OUTCOME_LABELS: Record<CrisisOutcome, string> = {
  strong: 'Strong first move',
  mixed: 'Partial move',
  weak: 'Missed first move',
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value))
}

export function applyMetricDelta(metrics: Metrics, delta: Metrics): Metrics {
  return {
    latency: clamp(metrics.latency + delta.latency),
    reliability: clamp(metrics.reliability + delta.reliability),
    cost: clamp(metrics.cost + delta.cost),
    confidence: clamp(metrics.confidence + delta.confidence),
  }
}

export function getHealthLabel(value: number) {
  if (value >= 80) return 'Strong'
  if (value >= 60) return 'Stable'
  if (value >= 40) return 'Shaky'
  return 'Critical'
}

export function getOutcomeTone(outcome: CrisisOutcome) {
  if (outcome === 'strong') return 'success'
  if (outcome === 'mixed') return 'mixed'
  return 'danger'
}

export function evaluateConceptCoverage(answer: string, concepts: ArenaConcept[]): FollowupAssessment {
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

export function gradeBadge(grade: ArenaGrade) {
  if (grade === 'Strong') return '🟢'
  if (grade === 'Decent') return '🟡'
  return '🔴'
}

export function gradePoints(grade: ArenaGrade) {
  if (grade === 'Strong') return 30
  if (grade === 'Decent') return 15
  return 5
}

export function calculateInterviewReadiness(metrics: Metrics) {
  return Math.round((metrics.latency + metrics.reliability + metrics.confidence - metrics.cost * 0.35) / 2.65)
}

export function buildAttemptRecord(answer: string, concepts: ArenaConcept[], elapsedSec: number): AttemptRecord {
  const assessment = evaluateConceptCoverage(answer, concepts)
  const fastBonus = elapsedSec <= FAST_RESPONSE_THRESHOLD_SEC ? FAST_RESPONSE_BONUS : 0

  return {
    text: answer.trim(),
    coverageCount: assessment.coverageCount,
    coverageRatio: assessment.coverageRatio,
    grade: assessment.grade,
    timeSpentSec: elapsedSec,
    fastBonus,
  }
}

export function buildRoundArtifact(
  scenario: ArenaScenario,
  action: ArenaAction,
  timeRemainingSec: number,
): ArenaArtifact {
  return {
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
      timeRemainingSec,
      confidence: action.outcome === 'strong' ? 'high' : action.outcome === 'mixed' ? 'medium' : 'low',
    },
  }
}

export function getAttemptImprovement(firstAttempt: AttemptRecord | null, secondAttempt: AttemptRecord | null) {
  if (!firstAttempt || !secondAttempt) return 0
  return secondAttempt.coverageCount - firstAttempt.coverageCount
}

export function shouldAwardImprovementBonus(firstAttempt: AttemptRecord, secondAttempt: AttemptRecord) {
  return compareAttempts(firstAttempt.coverageRatio, secondAttempt.coverageRatio)
}

export type CrisisModeLoadResult = {
  topicDetails: TopicDetails
  scenarios: ArenaScenario[]
}
