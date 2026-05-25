import type {
  DecisionCard,
  DecisionResolution,
  EventCard,
  EventContributor,
  EventResolution,
  GameCard,
  RoundDefinition,
  RunState,
  StatDelta,
  SubjectDefinition,
} from './types'

function clamp(value: number, min = -999, max = 999) {
  return Math.max(min, Math.min(max, value))
}

function applyDelta<Key extends string>(state: Record<Key, number>, delta?: StatDelta<Key>) {
  if (!delta) return state

  const nextState = { ...state }
  for (const [key, value] of Object.entries(delta) as [Key, number][]) {
    nextState[key] = clamp((nextState[key] ?? 0) + value)
  }
  return nextState
}

export function createRunState<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  subject: SubjectDefinition<VisibleKey, HiddenKey, Tag>,
): RunState<VisibleKey, HiddenKey, Tag> {
  return {
    subjectId: subject.id,
    visible: { ...subject.initialVisible },
    hidden: { ...subject.initialHidden },
    budget: subject.initialBudget ?? 0,
    tags: [],
    roundIndex: 0,
    phase: subject.rounds.length === 0 ? 'complete' : 'decision',
    currentDecisionResolution: null,
    currentEventResolution: null,
    log: [],
  }
}

export function getCurrentRound<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  subject: SubjectDefinition<VisibleKey, HiddenKey, Tag>,
  run: RunState<VisibleKey, HiddenKey, Tag>,
): RoundDefinition | null {
  return subject.rounds[run.roundIndex] ?? null
}

function getCardById<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  subject: SubjectDefinition<VisibleKey, HiddenKey, Tag>,
  cardId: string,
): GameCard<VisibleKey, HiddenKey, Tag> {
  const card = subject.cards[cardId]
  if (!card) throw new Error(`Unknown card "${cardId}"`)
  return card
}

export function getCurrentCard<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  subject: SubjectDefinition<VisibleKey, HiddenKey, Tag>,
  run: RunState<VisibleKey, HiddenKey, Tag>,
): GameCard<VisibleKey, HiddenKey, Tag> | null {
  const round = getCurrentRound(subject, run)
  if (!round) return null

  if (run.phase === 'decision' || run.phase === 'decision_result') {
    return getCardById(subject, round.decisionId)
  }

  if (run.phase === 'followup_decision' || run.phase === 'followup_result') {
    if (!round.followup) return null
    return getCardById(subject, round.followup.decisionId)
  }

  if (run.phase === 'event_preview' || run.phase === 'event_result') {
    return getCardById(subject, round.eventId)
  }

  return null
}

function asDecisionCardStrict<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  card: GameCard<VisibleKey, HiddenKey, Tag> | null,
): DecisionCard<VisibleKey, HiddenKey, Tag> {
  if (!card || card.kind !== 'decision') {
    throw new Error('Current card is not a decision')
  }
  return card
}

function asEventCardStrict<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  card: GameCard<VisibleKey, HiddenKey, Tag> | null,
): EventCard<VisibleKey, HiddenKey, Tag> {
  if (!card || card.kind !== 'event') {
    throw new Error('Current card is not an event')
  }
  return card
}

export function resolveDecision<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  subject: SubjectDefinition<VisibleKey, HiddenKey, Tag>,
  run: RunState<VisibleKey, HiddenKey, Tag>,
  optionId: string,
): { run: RunState<VisibleKey, HiddenKey, Tag>; resolution: DecisionResolution<VisibleKey, HiddenKey, Tag> } {
  const card = asDecisionCardStrict(getCurrentCard(subject, run))
  const option = card.options.find((candidate) => candidate.id === optionId)
  if (!option) {
    throw new Error(`Unknown option "${optionId}" for decision "${card.id}"`)
  }

  const resolution: DecisionResolution<VisibleKey, HiddenKey, Tag> = {
    cardId: card.id,
    optionId: option.id,
    effects: option.effects,
  }

  return {
    resolution,
    run: {
      ...run,
      visible: applyDelta(run.visible, option.effects.visible),
      hidden: applyDelta(run.hidden, option.effects.hidden),
      budget: run.budget - (option.effects.budget ?? 0),
      tags: [...new Set([...run.tags, ...(option.effects.tags ?? [])])],
      phase: run.phase === 'followup_decision' ? 'followup_result' : 'decision_result',
      currentDecisionResolution: resolution,
      log: [...run.log, { kind: 'decision', resolution }],
    },
  }
}

function scoreEvent<HiddenKey extends string, Tag extends string>(
  card: EventCard<string, HiddenKey, Tag>,
  run: RunState<string, HiddenKey, Tag>,
) {
  const contributors: EventContributor<HiddenKey, Tag>[] = []
  let score = 0

  for (const test of card.tests) {
    const value = run.hidden[test.key] ?? 0
    const contribution = value * test.weight
    score += contribution
    contributors.push({
      type: 'stat',
      key: test.key,
      weight: test.weight,
      value,
      contribution,
    })
  }

  for (const tagRule of card.tagRules ?? []) {
    if (!run.tags.includes(tagRule.tag)) continue
    score += tagRule.score
    contributors.push({
      type: 'tag',
      tag: tagRule.tag,
      contribution: tagRule.score,
      reason: tagRule.reason,
    })
  }

  return { score, contributors }
}

function getEventOutcome<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  card: EventCard<VisibleKey, HiddenKey, Tag>,
  score: number,
) {
  if (score >= card.thresholds.success) return 'success'
  if (score >= card.thresholds.partial) return 'partial'
  return 'failure'
}

export function resolveEvent<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  subject: SubjectDefinition<VisibleKey, HiddenKey, Tag>,
  run: RunState<VisibleKey, HiddenKey, Tag>,
): { run: RunState<VisibleKey, HiddenKey, Tag>; resolution: EventResolution<VisibleKey, HiddenKey, Tag> } {
  const card = asEventCardStrict(getCurrentCard(subject, run))
  const { score, contributors } = scoreEvent(card as EventCard<string, HiddenKey, Tag>, run as RunState<string, HiddenKey, Tag>)
  const outcome = getEventOutcome(card, score)
  const visibleEffects = card.outcomes[outcome].visible

  const resolution: EventResolution<VisibleKey, HiddenKey, Tag> = {
    cardId: card.id,
    outcome,
    score,
    contributors,
    visibleEffects,
    visibleBefore: run.visible,
    visibleAfter: applyDelta(run.visible, visibleEffects),
    summary: card.outcomes[outcome].summary,
  }

  return {
    resolution,
    run: {
      ...run,
      visible: resolution.visibleAfter,
      phase: 'event_result',
      currentEventResolution: resolution,
      log: [...run.log, { kind: 'event', resolution }],
    },
  }
}

export function continueRun<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  subject: SubjectDefinition<VisibleKey, HiddenKey, Tag>,
  run: RunState<VisibleKey, HiddenKey, Tag>,
): RunState<VisibleKey, HiddenKey, Tag> {
  const round = getCurrentRound(subject, run)

  if (!round) return { ...run, phase: 'complete' }

  if (run.phase === 'decision_result') {
    const triggerFollowup =
      round.followup &&
      run.currentDecisionResolution?.cardId === round.decisionId &&
      round.followup.triggerOptionIds.includes(run.currentDecisionResolution.optionId)

    return {
      ...run,
      phase: triggerFollowup ? 'followup_decision' : 'event_preview',
      currentDecisionResolution: null,
    }
  }

  if (run.phase === 'followup_result') {
    return {
      ...run,
      phase: 'event_preview',
      currentDecisionResolution: null,
    }
  }

  if (run.phase === 'event_result') {
    const nextRoundIndex = run.roundIndex + 1
    const hasNextRound = nextRoundIndex < subject.rounds.length

    return {
      ...run,
      roundIndex: hasNextRound ? nextRoundIndex : run.roundIndex,
      phase: hasNextRound ? 'decision' : 'complete',
      currentDecisionResolution: null,
      currentEventResolution: null,
    }
  }

  return run
}

export function isRunComplete<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  run: RunState<VisibleKey, HiddenKey, Tag>,
) {
  return run.phase === 'complete'
}

export function asDecisionCard<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  card: GameCard<VisibleKey, HiddenKey, Tag> | null,
): DecisionCard<VisibleKey, HiddenKey, Tag> | null {
  return card?.kind === 'decision' ? card : null
}

export function asEventCard<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  card: GameCard<VisibleKey, HiddenKey, Tag> | null,
): EventCard<VisibleKey, HiddenKey, Tag> | null {
  return card?.kind === 'event' ? card : null
}
