import type {
  DecisionCard,
  DecisionResolution,
  EventCard,
  EventContributor,
  EventResolution,
  GameCard,
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

function dedupeAppend(queue: string[], insertAt: number, ids: string[]) {
  if (ids.length === 0) return queue

  const nextQueue = [...queue]
  const safeIds = ids.filter((id) => !nextQueue.includes(id))
  if (safeIds.length === 0) return nextQueue

  nextQueue.splice(insertAt, 0, ...safeIds)
  return nextQueue
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
    queue: [...subject.sequence],
    currentCardIndex: 0,
    log: [],
  }
}

export function getCurrentCard<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  subject: SubjectDefinition<VisibleKey, HiddenKey, Tag>,
  run: RunState<VisibleKey, HiddenKey, Tag>,
): GameCard<VisibleKey, HiddenKey, Tag> | null {
  const cardId = run.queue[run.currentCardIndex]
  if (!cardId) return null
  return subject.cards[cardId] ?? null
}

export function resolveDecision<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  subject: SubjectDefinition<VisibleKey, HiddenKey, Tag>,
  run: RunState<VisibleKey, HiddenKey, Tag>,
  optionId: string,
): { run: RunState<VisibleKey, HiddenKey, Tag>; resolution: DecisionResolution<VisibleKey, HiddenKey, Tag> } {
  const card = getCurrentCard(subject, run)
  if (!card || card.kind !== 'decision') {
    throw new Error('Current card is not a decision')
  }

  const option = card.options.find((candidate) => candidate.id === optionId)
  if (!option) {
    throw new Error(`Unknown option "${optionId}" for decision "${card.id}"`)
  }

  const followupIds = (option.followups ?? []).map((link) => link.decisionId)
  const nextQueue = dedupeAppend(run.queue, run.currentCardIndex + 1, followupIds)

  const resolution: DecisionResolution<VisibleKey, HiddenKey, Tag> = {
    cardId: card.id,
    optionId: option.id,
    effects: option.effects,
    insertedFollowups: followupIds,
  }

  return {
    resolution,
    run: {
      ...run,
      visible: applyDelta(run.visible, option.effects.visible),
      hidden: applyDelta(run.hidden, option.effects.hidden),
      budget: run.budget - (option.effects.budget ?? 0),
      tags: [...new Set([...run.tags, ...(option.effects.tags ?? [])])],
      queue: nextQueue,
      currentCardIndex: run.currentCardIndex + 1,
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
  const card = getCurrentCard(subject, run)
  if (!card || card.kind !== 'event') {
    throw new Error('Current card is not an event')
  }

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
      currentCardIndex: run.currentCardIndex + 1,
      log: [...run.log, { kind: 'event', resolution }],
    },
  }
}

export function isRunComplete<VisibleKey extends string, HiddenKey extends string, Tag extends string>(
  run: RunState<VisibleKey, HiddenKey, Tag>,
) {
  return run.currentCardIndex >= run.queue.length
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
