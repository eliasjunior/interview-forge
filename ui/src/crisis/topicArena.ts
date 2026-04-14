import type { TopicDetails } from '../api'
import type { CrisisOutcome } from './dataAccessTradeoffsCampaign'

export const CRISIS_TOPIC_FILE = 'data-access-tradeoffs-growing-complexity'

export type ArenaGrade = 'Strong' | 'Decent' | 'Weak'

export type ArenaConcept = {
  label: string
  keywords: string[]
}

export type ArenaAction = {
  id: string
  label: string
  outcome: CrisisOutcome
  rationale: string
}

export type ArenaScenario = {
  id: string
  topicFile: string
  topicTitle: string
  title: string
  stage: 'foundation' | 'intermediate' | 'advanced'
  sourceQuestionIndex: number
  prompt: string
  followupPrompt: string
  actions: ArenaAction[]
  expectedConcepts: ArenaConcept[]
  twistPrompt: string
}

type ScenarioSeed = {
  questionIndex: number
  title: string
  stage: 'foundation' | 'intermediate' | 'advanced'
  actions: ArenaAction[]
  expectedConcepts: ArenaConcept[]
  twistPrompt: string
}

const SCENARIO_SEEDS: ScenarioSeed[] = [
  {
    questionIndex: 3,
    title: 'Browse API Meltdown',
    stage: 'foundation',
    actions: [
      {
        id: 'q4-pagination',
        label: 'Move to bounded server-side pagination',
        outcome: 'strong',
        rationale: 'The browse contract must stop returning the full dataset and only serve bounded slices.',
      },
      {
        id: 'q4-cache-all',
        label: 'Cache the full dataset response',
        outcome: 'mixed',
        rationale: 'Caching repeated work helps some latency, but it keeps the unsafe full-list contract.',
      },
      {
        id: 'q4-scale-app',
        label: 'Scale API nodes only',
        outcome: 'weak',
        rationale: 'More application nodes do not change the amount of data returned per request.',
      },
    ],
    expectedConcepts: [
      { label: 'bounded results', keywords: ['bounded', 'slice', 'subset', 'page'] },
      { label: 'page size limit', keywords: ['limit', 'page size', 'max size', 'cap'] },
      { label: 'deterministic ordering', keywords: ['deterministic', 'stable ordering', 'ordered', 'sort'] },
      { label: 'ui and latency safety', keywords: ['latency', 'memory', 'bandwidth', 'ui'] },
    ],
    twistPrompt: 'Users browse page 10,000 and it becomes slow. What do you change?',
  },
  {
    questionIndex: 5,
    title: 'Deep Pagination Breakdown',
    stage: 'intermediate',
    actions: [
      {
        id: 'q6-cursor',
        label: 'Switch to cursor pagination',
        outcome: 'strong',
        rationale: 'Deep offset queries degrade because the database still walks past many rows before returning the page.',
      },
      {
        id: 'q6-bigger-page',
        label: 'Increase page size',
        outcome: 'mixed',
        rationale: 'Bigger pages reduce clicks but usually make the deep browse path heavier.',
      },
      {
        id: 'q6-more-indexes',
        label: 'Keep offset pagination and add indexes only',
        outcome: 'weak',
        rationale: 'Indexes help some patterns, but they do not remove the fundamental skip cost of deep offsets.',
      },
    ],
    expectedConcepts: [
      { label: 'offset cost', keywords: ['offset', 'skip', 'walk rows', 'scan'] },
      { label: 'cursor pagination', keywords: ['cursor', 'seek', 'continuation', 'token'] },
      { label: 'stable ordering', keywords: ['stable ordering', 'deterministic', 'ordered', 'anchor'] },
      { label: 'next-page contract', keywords: ['next cursor', 'continuation', 'response shape', 'token'] },
    ],
    twistPrompt: 'Items shift between pages during updates. How do you fix it?',
  },
  {
    questionIndex: 10,
    title: 'Caching Trade-off Pressure',
    stage: 'advanced',
    actions: [
      {
        id: 'q11-cache-policy',
        label: 'Cache with explicit freshness rules',
        outcome: 'strong',
        rationale: 'Caching helps only if the freshness policy and invalidation rules are explicit.',
      },
      {
        id: 'q11-long-ttl',
        label: 'Cache everything with a long TTL',
        outcome: 'mixed',
        rationale: 'A blunt TTL may reduce load but can hide staleness bugs.',
      },
      {
        id: 'q11-no-cache',
        label: 'Disable caching entirely',
        outcome: 'weak',
        rationale: 'That protects freshness but may collapse under hot read traffic.',
      },
    ],
    expectedConcepts: [
      { label: 'cache invalidation', keywords: ['invalidate', 'invalidation', 'refresh', 'evict'] },
      { label: 'freshness vs latency', keywords: ['freshness', 'stale', 'latency', 'recent values'] },
      { label: 'bypass rules', keywords: ['bypass', 'critical reads', 'sensitive reads', 'strict reads'] },
      { label: 'cache stampede risk', keywords: ['stampede', 'thundering herd', 'hot key', 'miss storm'] },
    ],
    twistPrompt: 'Cached data is stale during critical reads. What do you do?',
  },
  {
    questionIndex: 11,
    title: 'Freshness Under Peak Load',
    stage: 'advanced',
    actions: [
      {
        id: 'q12-freshness-policy',
        label: 'Use TTL plus bypass for freshness-sensitive reads',
        outcome: 'strong',
        rationale: 'The service needs an explicit policy for what can be stale and what must bypass cache.',
      },
      {
        id: 'q12-short-ttl',
        label: 'Use a very short TTL for everything',
        outcome: 'mixed',
        rationale: 'This helps a bit, but it is still too blunt if some reads are correctness-sensitive.',
      },
      {
        id: 'q12-db-direct',
        label: 'Send all reads directly to the database',
        outcome: 'weak',
        rationale: 'That preserves freshness but ignores the peak read bottleneck.',
      },
    ],
    expectedConcepts: [
      { label: 'freshness policy', keywords: ['policy', 'staleness tolerance', 'freshness'] },
      { label: 'ttl choice', keywords: ['ttl', 'expiry', 'expiration'] },
      { label: 'critical-read bypass', keywords: ['bypass', 'critical', 'sensitive', 'strict'] },
      { label: 'correctness risk', keywords: ['correctness', 'stale', 'dangerously stale', 'risk'] },
    ],
    twistPrompt: 'A critical report cannot tolerate stale values. Which reads bypass cache and why?',
  },
]

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function normalizeQuestionText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function extractCandidatePrompt(text: string) {
  const evaluatorSectionPattern =
    /\s+(Evaluation criteria:|Strong answer:|Weak answer:|Model answer:|Expected answer:|Rubric:|Scoring hints?:|Hint:|Follow-up:)\s*/i
  const match = evaluatorSectionPattern.exec(text)
  const candidateText = match ? text.slice(0, match.index) : text
  return normalizeQuestionText(candidateText)
}

export function buildArenaScenariosFromTopic(topic: TopicDetails): ArenaScenario[] {
  const scenarios = SCENARIO_SEEDS.flatMap((seed) => {
    const question = topic.questions.find((candidate) => candidate.index === seed.questionIndex)
    if (!question) return []

    const candidatePrompt = extractCandidatePrompt(question.text)

    return [{
      id: `${topic.file}-q${question.index + 1}`,
      topicFile: topic.file,
      topicTitle: topic.topic,
      title: seed.title,
      stage: seed.stage,
      sourceQuestionIndex: question.index,
      prompt: candidatePrompt,
      followupPrompt: [
        `Original authored question: ${candidatePrompt}`,
        '',
        'Defend your chosen first move like a system design interview candidate.',
        'Keep the answer tight and specific to the trade-offs in this topic.',
      ].join('\n'),
      actions: seed.actions,
      expectedConcepts: seed.expectedConcepts,
      twistPrompt: seed.twistPrompt,
    }]
  })

  return shuffle(scenarios)
}

export function getGrade(coverage: number): ArenaGrade {
  if (coverage >= 0.8) return 'Strong'
  if (coverage >= 0.4) return 'Decent'
  return 'Weak'
}

export function compareAttempts(firstCoverage: number, secondCoverage: number) {
  return secondCoverage > firstCoverage
}
