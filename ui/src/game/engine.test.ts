import { describe, expect, it } from 'vitest'
import { continueRun, createRunState, getCurrentCard, isRunComplete, resolveDecision, resolveEvent } from './engine'
import { orderCreationSubject } from './content/orderCreation'
import type { SubjectDefinition } from './types'

describe('game engine', () => {
  it('moves a simple round through decision, calm result, event preview, and event result', () => {
    let run = createRunState(orderCreationSubject)

    expect(run.phase).toBe('decision')
    expect(getCurrentCard(orderCreationSubject, run)?.id).toBe('endpoint-design')

    ;({ run } = resolveDecision(orderCreationSubject, run, 'post-orders'))
    expect(run.phase).toBe('decision_result')
    expect(run.currentDecisionResolution?.optionId).toBe('post-orders')
    expect(getCurrentCard(orderCreationSubject, run)?.id).toBe('endpoint-design')

    run = continueRun(orderCreationSubject, run)
    expect(run.phase).toBe('event_preview')
    expect(getCurrentCard(orderCreationSubject, run)?.id).toBe('duplicate-submission')

    const eventResult = resolveEvent(orderCreationSubject, run)
    run = eventResult.run
    expect(run.phase).toBe('event_result')
    expect(eventResult.resolution.outcome).toBe('success')
    expect(eventResult.resolution.summary).toContain('contract held together')
  })

  it('enters the async follow-up decision before the final event when the trigger option is chosen', () => {
    let run = createRunState(orderCreationSubject)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'post-orders'))
    run = continueRun(orderCreationSubject, run)
    ;({ run } = resolveEvent(orderCreationSubject, run))
    run = continueRun(orderCreationSubject, run)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'idempotency-key'))
    run = continueRun(orderCreationSubject, run)
    ;({ run } = resolveEvent(orderCreationSubject, run))
    run = continueRun(orderCreationSubject, run)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'split-async'))
    expect(run.phase).toBe('decision_result')

    run = continueRun(orderCreationSubject, run)
    expect(run.phase).toBe('followup_decision')
    expect(getCurrentCard(orderCreationSubject, run)?.id).toBe('async-failure-handling')

    ;({ run } = resolveDecision(orderCreationSubject, run, 'tracked-retries'))
    expect(run.phase).toBe('followup_result')

    run = continueRun(orderCreationSubject, run)
    expect(run.phase).toBe('event_preview')
    expect(getCurrentCard(orderCreationSubject, run)?.id).toBe('payment-instability-spike')
  })

  it('resolves a strong full run into successful events and completion', () => {
    let run = createRunState(orderCreationSubject)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'post-orders'))
    run = continueRun(orderCreationSubject, run)
    ;({ run } = resolveEvent(orderCreationSubject, run))
    run = continueRun(orderCreationSubject, run)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'idempotency-key'))
    run = continueRun(orderCreationSubject, run)
    ;({ run } = resolveEvent(orderCreationSubject, run))
    run = continueRun(orderCreationSubject, run)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'split-async'))
    run = continueRun(orderCreationSubject, run)
    ;({ run } = resolveDecision(orderCreationSubject, run, 'tracked-retries'))
    run = continueRun(orderCreationSubject, run)

    const { resolution, run: nextRun } = resolveEvent(orderCreationSubject, run)

    expect(resolution.outcome).toBe('success')
    expect(resolution.summary).toContain('absorbs the spike')
    expect(nextRun.visible.businessHealth).toBe(13)
    expect(nextRun.visible.momentum).toBe(3)

    run = continueRun(orderCreationSubject, nextRun)
    expect(isRunComplete(run)).toBe(true)
  })

  it('resolves a weak full run into repeated failures and completion', () => {
    let run = createRunState(orderCreationSubject)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'get-create-order'))
    run = continueRun(orderCreationSubject, run)
    ;({ run } = resolveEvent(orderCreationSubject, run))
    run = continueRun(orderCreationSubject, run)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'client-handles-retries'))
    run = continueRun(orderCreationSubject, run)
    ;({ run } = resolveEvent(orderCreationSubject, run))
    run = continueRun(orderCreationSubject, run)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'everything-sync'))
    run = continueRun(orderCreationSubject, run)

    const { resolution, run: nextRun } = resolveEvent(orderCreationSubject, run)

    expect(resolution.outcome).toBe('failure')
    expect(nextRun.visible.systemHealth).toBe(3)
    expect(nextRun.visible.businessHealth).toBe(4)
    expect(nextRun.visible.momentum).toBe(-3)

    run = continueRun(orderCreationSubject, nextRun)
    expect(isRunComplete(run)).toBe(true)
  })

  it('throws on unknown decision option ids', () => {
    const run = createRunState(orderCreationSubject)

    expect(() => resolveDecision(orderCreationSubject, run, 'missing-option')).toThrow('Unknown option "missing-option"')
  })

  it('returns the same run when continue is pressed outside a result phase', () => {
    const run = createRunState(orderCreationSubject)

    expect(continueRun(orderCreationSubject, run)).toBe(run)
  })

  it('throws when resolving an event from a non-event phase', () => {
    const run = createRunState(orderCreationSubject)

    expect(() => resolveEvent(orderCreationSubject, run)).toThrow('Current card is not an event')
  })

  it('handles empty subjects as already complete', () => {
    const emptySubject: SubjectDefinition<'health', 'reliability', 'tag'> = {
      id: 'empty',
      title: 'Empty',
      visibleKeys: ['health'],
      hiddenKeys: ['reliability'],
      initialVisible: { health: 1 },
      initialHidden: { reliability: 0 },
      rounds: [],
      cards: {},
    }

    const run = createRunState(emptySubject)

    expect(run.phase).toBe('complete')
    expect(getCurrentCard(emptySubject, run)).toBeNull()
    expect(() => resolveDecision(emptySubject, run, 'missing')).toThrow('Current card is not a decision')
    expect(() => resolveEvent(emptySubject, run)).toThrow('Current card is not an event')
  })
})
