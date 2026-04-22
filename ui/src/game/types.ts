export type StatMap<Key extends string> = Record<Key, number>

export type StatDelta<Key extends string> = Partial<Record<Key, number>>

export type CardKind = 'decision' | 'event'

export type EventOutcome = 'success' | 'partial' | 'failure'

export type WeightedStat<Key extends string> = {
  key: Key
  weight: number
}

export type OptionEffect<VisibleKey extends string, HiddenKey extends string, Tag extends string> = {
  visible?: StatDelta<VisibleKey>
  hidden?: StatDelta<HiddenKey>
  budget?: number
  tags?: Tag[]
}

export type FollowupLink = {
  decisionId: string
  insert: 'next'
}

export type PlayerDecisionFeedback = {
  narrative: string[]
  status: string[]
}

export type DecisionOption<VisibleKey extends string, HiddenKey extends string, Tag extends string> = {
  id: string
  label: string
  description: string
  rationale: string
  effects: OptionEffect<VisibleKey, HiddenKey, Tag>
  playerFeedback?: PlayerDecisionFeedback
  followups?: FollowupLink[]
}

export type DecisionCard<VisibleKey extends string, HiddenKey extends string, Tag extends string> = {
  id: string
  kind: 'decision'
  title: string
  scenario: string
  options: DecisionOption<VisibleKey, HiddenKey, Tag>[]
}

export type EventTagRule<Tag extends string> = {
  tag: Tag
  score: number
  reason: string
}

export type EventStatFeedback = {
  positive: string
  negative: string
  neutral?: string
}

export type EventOutcomeSpec<VisibleKey extends string> = {
  visible: StatDelta<VisibleKey>
  summary: string
}

export type EventCard<VisibleKey extends string, HiddenKey extends string, Tag extends string> = {
  id: string
  kind: 'event'
  title: string
  scenario: string
  tests: WeightedStat<HiddenKey>[]
  statFeedback?: Partial<Record<HiddenKey, EventStatFeedback>>
  tagRules?: EventTagRule<Tag>[]
  thresholds: {
    success: number
    partial: number
  }
  outcomes: Record<EventOutcome, EventOutcomeSpec<VisibleKey>>
}

export type GameCard<VisibleKey extends string, HiddenKey extends string, Tag extends string> =
  | DecisionCard<VisibleKey, HiddenKey, Tag>
  | EventCard<VisibleKey, HiddenKey, Tag>

export type SubjectDefinition<VisibleKey extends string, HiddenKey extends string, Tag extends string> = {
  id: string
  title: string
  visibleKeys: readonly VisibleKey[]
  hiddenKeys: readonly HiddenKey[]
  initialVisible: StatMap<VisibleKey>
  initialHidden: StatMap<HiddenKey>
  initialBudget?: number
  sequence: string[]
  cards: Record<string, GameCard<VisibleKey, HiddenKey, Tag>>
}

export type DecisionResolution<VisibleKey extends string, HiddenKey extends string, Tag extends string> = {
  cardId: string
  optionId: string
  effects: OptionEffect<VisibleKey, HiddenKey, Tag>
  insertedFollowups: string[]
}

export type EventContributor<HiddenKey extends string, Tag extends string> =
  | { type: 'stat'; key: HiddenKey; weight: number; value: number; contribution: number }
  | { type: 'tag'; tag: Tag; contribution: number; reason: string }

export type EventResolution<VisibleKey extends string, HiddenKey extends string, Tag extends string> = {
  cardId: string
  outcome: EventOutcome
  score: number
  contributors: EventContributor<HiddenKey, Tag>[]
  visibleEffects: StatDelta<VisibleKey>
  visibleBefore: StatMap<VisibleKey>
  visibleAfter: StatMap<VisibleKey>
  summary: string
}

export type TurnLog<VisibleKey extends string, HiddenKey extends string, Tag extends string> =
  | { kind: 'decision'; resolution: DecisionResolution<VisibleKey, HiddenKey, Tag> }
  | { kind: 'event'; resolution: EventResolution<VisibleKey, HiddenKey, Tag> }

export type RunState<VisibleKey extends string, HiddenKey extends string, Tag extends string> = {
  subjectId: string
  visible: StatMap<VisibleKey>
  hidden: StatMap<HiddenKey>
  budget: number
  tags: Tag[]
  queue: string[]
  currentCardIndex: number
  log: TurnLog<VisibleKey, HiddenKey, Tag>[]
}
