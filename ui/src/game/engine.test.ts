import { describe, expect, it } from 'vitest'
import { createRunState, getCurrentCard, isRunComplete, resolveDecision, resolveEvent } from './engine'
import { orderCreationSubject } from './content/orderCreation'

describe('game engine', () => {
  it('inserts follow-up decisions immediately after the triggering option', () => {
    let run = createRunState(orderCreationSubject)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'post-orders'))
    ;({ run } = resolveDecision(orderCreationSubject, run, 'idempotency-key'))
    ;({ run } = resolveDecision(orderCreationSubject, run, 'split-async'))

    expect(run.queue).toEqual([
      'endpoint-design',
      'idempotency',
      'processing-flow',
      'async-failure-handling',
      'payment-instability-spike',
    ])
    expect(getCurrentCard(orderCreationSubject, run)?.id).toBe('async-failure-handling')
  })

  it('resolves a strong async run into a successful event', () => {
    let run = createRunState(orderCreationSubject)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'post-orders'))
    ;({ run } = resolveDecision(orderCreationSubject, run, 'idempotency-key'))
    ;({ run } = resolveDecision(orderCreationSubject, run, 'split-async'))
    ;({ run } = resolveDecision(orderCreationSubject, run, 'tracked-retries'))

    const { resolution, run: nextRun } = resolveEvent(orderCreationSubject, run)

    expect(resolution.outcome).toBe('success')
    expect(resolution.summary).toContain('absorbs the spike')
    expect(nextRun.visible.businessHealth).toBe(12)
    expect(nextRun.visible.momentum).toBe(1)
  })

  it('resolves a weak synchronous run into failure', () => {
    let run = createRunState(orderCreationSubject)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'get-create-order'))
    ;({ run } = resolveDecision(orderCreationSubject, run, 'client-handles-retries'))
    ;({ run } = resolveDecision(orderCreationSubject, run, 'everything-sync'))

    const { resolution, run: nextRun } = resolveEvent(orderCreationSubject, run)

    expect(resolution.outcome).toBe('failure')
    expect(nextRun.visible.systemHealth).toBe(7)
    expect(nextRun.visible.businessHealth).toBe(8)
    expect(isRunComplete(nextRun)).toBe(true)
  })

  it('throws when resolving a decision from a non-decision card', () => {
    let run = createRunState(orderCreationSubject)

    ;({ run } = resolveDecision(orderCreationSubject, run, 'post-orders'))
    ;({ run } = resolveDecision(orderCreationSubject, run, 'idempotency-key'))
    ;({ run } = resolveDecision(orderCreationSubject, run, 'everything-sync'))

    expect(() => resolveDecision(orderCreationSubject, run, 'post-orders')).toThrow('Current card is not a decision')
  })

  it('throws on unknown decision option ids', () => {
    const run = createRunState(orderCreationSubject)

    expect(() => resolveDecision(orderCreationSubject, run, 'missing-option')).toThrow('Unknown option "missing-option"')
  })

  it('throws when resolving an event from a non-event card', () => {
    const run = createRunState(orderCreationSubject)

    expect(() => resolveEvent(orderCreationSubject, run)).toThrow('Current card is not an event')
  })
})
