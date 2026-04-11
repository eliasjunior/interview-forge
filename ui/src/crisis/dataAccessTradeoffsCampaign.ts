export type CrisisStage = 'foundation' | 'intermediate' | 'advanced'

export type CrisisOutcome = 'strong' | 'mixed' | 'weak'

export type CrisisAction = {
  id: string
  label: string
  outcome: CrisisOutcome
  rationale: string
  conceptsExercised: string[]
}

export type CrisisScenario = {
  id: string
  topicFile: string
  title: string
  stage: CrisisStage
  sourceQuestionHint?: number
  prompt: string
  actions: CrisisAction[]
}

export type CrisisRoundArtifact = {
  artifactType: 'crisis_round'
  topicFile: string
  scenarioId: string
  scenarioStage: CrisisStage
  sourceQuestionHint?: number
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
  conceptsExercised: string[]
}

export const DATA_ACCESS_TRADEOFFS_TOPIC_FILE = 'data-access-tradeoffs-growing-complexity'

export const dataAccessTradeoffsCampaign: CrisisScenario[] = [
  {
    id: 'browse-api-meltdown',
    topicFile: DATA_ACCESS_TRADEOFFS_TOPIC_FILE,
    title: 'Browse API Meltdown',
    stage: 'foundation',
    sourceQuestionHint: 4,
    prompt:
      'Your endpoint now drives a browse screen. With production-like data, response times are long, memory usage is high, and the UI is nearly unusable. What do you change first?',
    actions: [
      {
        id: 'add-server-side-pagination',
        label: 'Add server-side pagination',
        outcome: 'strong',
        rationale:
          'This fixes the unsafe full-list browse contract by moving to bounded reads and returning only what the screen needs.',
        conceptsExercised: ['pagination', 'bounded-reads', 'avoid-in-memory-full-loads'],
      },
      {
        id: 'cache-full-response',
        label: 'Cache the full response aggressively',
        outcome: 'mixed',
        rationale:
          'Caching may reduce repeated work, but it does not fix the unbounded response shape and may create freshness issues.',
        conceptsExercised: ['caching', 'freshness-vs-latency'],
      },
      {
        id: 'scale-app-only',
        label: 'Scale application instances only',
        outcome: 'weak',
        rationale:
          'More app instances do not solve the core issue when the API contract still returns too much data per request.',
        conceptsExercised: ['simplicity-vs-scale'],
      },
    ],
  },
  {
    id: 'deep-page-slowdown',
    topicFile: DATA_ACCESS_TRADEOFFS_TOPIC_FILE,
    title: 'Deep Page Slowdown',
    stage: 'intermediate',
    sourceQuestionHint: 6,
    prompt:
      'Page 10,000 is now painfully slow even though each request still returns only 50 rows. What is the best redesign?',
    actions: [
      {
        id: 'switch-to-cursor-pagination',
        label: 'Switch to cursor / seek pagination',
        outcome: 'strong',
        rationale:
          'This removes the need to walk through large offsets and fits deep browsing better than page-number pagination.',
        conceptsExercised: ['cursor-pagination', 'offset-vs-cursor', 'query-planning'],
      },
      {
        id: 'add-more-db-indexes-only',
        label: 'Add more indexes and keep deep offsets',
        outcome: 'mixed',
        rationale:
          'Indexes can help, but they do not remove the fundamental skip cost of deep offset pagination.',
        conceptsExercised: ['database-index', 'query-planning'],
      },
      {
        id: 'increase-page-size',
        label: 'Increase page size to reduce clicks',
        outcome: 'weak',
        rationale:
          'Larger pages often make latency, memory, and bandwidth worse while leaving the deep offset problem in place.',
        conceptsExercised: ['page-size-limit'],
      },
    ],
  },
  {
    id: 'freshness-vs-load',
    topicFile: DATA_ACCESS_TRADEOFFS_TOPIC_FILE,
    title: 'Freshness vs Load',
    stage: 'advanced',
    sourceQuestionHint: 12,
    prompt:
      'The read path is hot and the database is under pressure, but users care about recent values. What should you do before the cache becomes a correctness bug?',
    actions: [
      {
        id: 'add-cache-policy-with-bypass',
        label: 'Use explicit cache freshness rules with bypass for sensitive reads',
        outcome: 'strong',
        rationale:
          'This treats caching as a correctness decision and makes freshness policy explicit instead of hiding staleness behind a generic cache.',
        conceptsExercised: ['cache-aside', 'ttl', 'invalidation', 'freshness-vs-latency'],
      },
      {
        id: 'cache-everything-for-ten-minutes',
        label: 'Cache everything for 10 minutes',
        outcome: 'weak',
        rationale:
          'A blunt TTL may reduce database pressure, but it can serve dangerously stale data if the business cares about recency.',
        conceptsExercised: ['ttl', 'cache-hit-rate-vs-correctness'],
      },
      {
        id: 'disable-caching-entirely',
        label: 'Disable caching completely and send all reads to the database',
        outcome: 'mixed',
        rationale:
          'This maximizes freshness, but it may not survive peak read load if the database is already the bottleneck.',
        conceptsExercised: ['freshness-vs-latency', 'read-performance-vs-write-cost'],
      },
    ],
  },
]

export function buildCrisisRoundArtifact(args: {
  scenario: CrisisScenario
  selectedActionId: string
  timeRemainingSec: number
  confidence?: 'low' | 'medium' | 'high'
}): CrisisRoundArtifact {
  const selectedAction = args.scenario.actions.find(action => action.id === args.selectedActionId)

  if (!selectedAction) {
    throw new Error(`Unknown action "${args.selectedActionId}" for scenario "${args.scenario.id}"`)
  }

  return {
    artifactType: 'crisis_round',
    topicFile: args.scenario.topicFile,
    scenarioId: args.scenario.id,
    scenarioStage: args.scenario.stage,
    sourceQuestionHint: args.scenario.sourceQuestionHint,
    scenarioPrompt: args.scenario.prompt,
    selectedAction: selectedAction.id,
    selectedActionLabel: selectedAction.label,
    alternatives: args.scenario.actions
      .filter(action => action.id !== selectedAction.id)
      .map(action => action.id),
    evaluation: {
      roundOutcome: selectedAction.outcome,
      reason: selectedAction.rationale,
    },
    signals: {
      timeRemainingSec: args.timeRemainingSec,
      confidence: args.confidence,
    },
    conceptsExercised: selectedAction.conceptsExercised,
  }
}

export function buildDataAccessFollowupPrompt(artifact: CrisisRoundArtifact): string {
  switch (artifact.selectedAction) {
    case 'add-server-side-pagination':
      return [
        'You chose to add server-side pagination to a browse endpoint that was returning the full dataset.',
        '',
        'Defend that decision like a system design interview candidate.',
        '',
        'Explain:',
        '1. why the old contract fails at scale',
        '2. what response shape you would return',
        '3. what limits you would enforce from day one',
        '4. how you would guarantee deterministic ordering',
        '5. when offset pagination becomes too expensive',
        '6. when you would migrate to cursor pagination',
      ].join('\n')

    case 'switch-to-cursor-pagination':
      return [
        'You chose to move deep browsing from offset pagination to cursor pagination.',
        '',
        'Defend that redesign like a system design interview candidate.',
        '',
        'Explain:',
        '1. why deep offsets degrade even when page size is small',
        '2. what field or fields should anchor the cursor',
        '3. how you would keep ordering stable while new data is inserted',
        '4. what response shape the client should receive',
        '5. what trade-offs this introduces compared with page-number pagination',
      ].join('\n')

    case 'add-cache-policy-with-bypass':
      return [
        'You chose to add caching with explicit freshness rules and bypass behavior for sensitive reads.',
        '',
        'Defend that choice like a system design interview candidate.',
        '',
        'Explain:',
        '1. what exactly you would cache',
        '2. how you would define freshness and staleness tolerance',
        '3. when the service should bypass the cache',
        '4. how invalidation or refresh should work',
        '5. what correctness risks appear if the cache policy is too naive',
      ].join('\n')

    default:
      return [
        `You chose "${artifact.selectedActionLabel}" in a Crisis Mode round about growing REST API read complexity.`,
        '',
        'Defend that decision like a system design interview candidate.',
        '',
        'Explain:',
        '1. what problem you believed was the primary bottleneck',
        '2. why your chosen move helps',
        '3. what trade-offs it introduces',
        '4. what you would measure next to validate the choice',
        '5. what follow-up redesign you would expect after this first step',
      ].join('\n')
  }
}
