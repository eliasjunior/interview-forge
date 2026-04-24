import type { SubjectDefinition } from '../types'

export const orderVisibleKeys = ['systemHealth', 'businessHealth', 'momentum'] as const
export const orderHiddenKeys = ['scalability', 'reliability', 'resilience', 'operability', 'complexity'] as const

export type OrderVisibleKey = typeof orderVisibleKeys[number]
export type OrderHiddenKey = typeof orderHiddenKeys[number]

export type OrderTag =
  | 'rest'
  | 'custom-action'
  | 'unsafe'
  | 'non-idempotent'
  | 'idempotent'
  | 'sync-processing'
  | 'async-processing'
  | 'partial-manual'
  | 'tracked-retries'

export const orderCreationSubject: SubjectDefinition<OrderVisibleKey, OrderHiddenKey, OrderTag> = {
  id: 'order-creation',
  title: 'Order Creation',
  visibleKeys: orderVisibleKeys,
  hiddenKeys: orderHiddenKeys,
  initialVisible: {
    systemHealth: 10,
    businessHealth: 10,
    momentum: 0,
  },
  initialHidden: {
    scalability: 0,
    reliability: 0,
    resilience: 0,
    operability: 0,
    complexity: 0,
  },
  initialBudget: 10,
  sequence: [
    'endpoint-design',
    'idempotency',
    'processing-flow',
    'payment-instability-spike',
  ],
  cards: {
    'endpoint-design': {
      id: 'endpoint-design',
      kind: 'decision',
      title: 'Order API Contract',
      scenario: 'We need an endpoint for creating customer orders. How should this API be exposed?',
      options: [
        {
          id: 'post-orders',
          label: 'POST /orders',
          description: 'Create orders through a resource-shaped endpoint.',
          rationale: 'Clear resource creation semantics keep the contract predictable.',
          effects: {
            hidden: { reliability: 1, operability: 1 },
            budget: 1,
            tags: ['rest'],
          },
          playerFeedback: {
            narrative: [
              'The team chose a clean resource endpoint for order creation.',
              'The contract feels predictable and fits how clients expect creation APIs to behave.',
            ],
            status: [
              'No visible incident',
              'No business loss',
              'Architectural clarity improved',
            ],
          },
        },
        {
          id: 'post-orders-create',
          label: 'POST /orders/create',
          description: 'Use an action-style endpoint for readability.',
          rationale: 'It works, but the contract is less standard and less portable.',
          effects: {
            budget: 1,
            tags: ['custom-action'],
          },
          playerFeedback: {
            narrative: [
              'The team moved fast and shipped an action-style endpoint.',
              'It works in normal conditions, but the contract is a bit less consistent.',
            ],
            status: [
              'No visible incident',
              'No business loss',
              'Architectural risk increased slightly',
            ],
          },
        },
        {
          id: 'get-create-order',
          label: 'GET /createOrder',
          description: 'Ship quickly using a query-driven endpoint.',
          rationale: 'Unsafe semantics create retry and caching risk.',
          effects: {
            hidden: { reliability: -2, operability: -1 },
            budget: 1,
            tags: ['unsafe'],
          },
          playerFeedback: {
            narrative: [
              'The team optimized for speed and used a read-shaped endpoint to create orders.',
              'It feels convenient now, but the contract is unsafe and will be harder to trust later.',
            ],
            status: [
              'No immediate incident',
              'Risk around retries and caching increased',
              'Architectural safety dropped',
            ],
          },
        },
      ],
    },
    idempotency: {
      id: 'idempotency',
      kind: 'decision',
      title: 'Network Uncertainty',
      scenario: 'Mobile clients sometimes lose the response and may send the same request again.',
      options: [
        {
          id: 'client-handles-retries',
          label: 'Rely on client-side retry behavior',
          description: 'Leave retry safety to clients and keep the backend simple.',
          rationale: 'This keeps the backend simple, but duplicates stay a correctness risk.',
          effects: {
            hidden: { reliability: -3, resilience: -1 },
            budget: 1,
            tags: ['non-idempotent'],
          },
          playerFeedback: {
            narrative: [
              'The backend stayed simple and pushed retry safety back to clients.',
              'That avoids extra storage now, but duplicate behavior is still unresolved.',
            ],
            status: [
              'No immediate business loss',
              'Retry risk remains in the system',
              'Failure recovery got weaker',
            ],
          },
        },
        {
          id: 'idempotency-key',
          label: 'Support idempotency keys',
          description: 'Record request identity so repeated submissions converge to one result.',
          rationale: 'This adds coordination cost, but it contains a real production failure mode.',
          effects: {
            hidden: { reliability: 3, resilience: 2, complexity: 1 },
            budget: 3,
            tags: ['idempotent'],
          },
          playerFeedback: {
            narrative: [
              'The team added a contract for safe retries before the issue became customer-visible.',
              'This adds coordination work, but it makes the API more trustworthy under shaky networks.',
            ],
            status: [
              'No visible incident',
              'Correctness got stronger',
              'Complexity increased slightly',
            ],
          },
        },
      ],
    },
    'processing-flow': {
      id: 'processing-flow',
      kind: 'decision',
      title: 'Order Completion Path',
      scenario: 'Creating an order also kicks off payment, inventory reservation, and confirmation email.',
      options: [
        {
          id: 'everything-sync',
          label: 'Everything synchronous in one request',
          description: 'Keep all work in one request path.',
          rationale: 'That lowers coordination overhead, but it makes the request path fragile under load.',
          effects: {
            hidden: { scalability: -1, resilience: -2 },
            budget: 1,
            tags: ['sync-processing'],
          },
          playerFeedback: {
            narrative: [
              'The team kept the workflow straightforward by doing everything in one request.',
              'That is easier to reason about today, but it puts more pressure on the hot path.',
            ],
            status: [
              'No visible incident',
              'Operational simplicity stayed high',
              'Scale risk increased',
            ],
          },
        },
        {
          id: 'split-async',
          label: 'Create the order, then process side effects asynchronously',
          description: 'Let the request finish before the secondary work completes.',
          rationale: 'This buys headroom, but it introduces a recovery problem you now have to own.',
          effects: {
            hidden: { scalability: 2, resilience: 2, complexity: 1, operability: -1 },
            budget: 3,
            tags: ['async-processing'],
          },
          playerFeedback: {
            narrative: [
              'The team protected the request path by moving secondary work into the background.',
              'That bought headroom, but it created a new failure-handling problem.',
            ],
            status: [
              'No visible incident',
              'System pressure decreased',
              'A follow-up recovery decision is now required',
            ],
          },
          followups: [{ decisionId: 'async-failure-handling', insert: 'next' }],
        },
      ],
    },
    'async-failure-handling': {
      id: 'async-failure-handling',
      kind: 'decision',
      title: 'Recovery Plan',
      scenario: 'Some background steps fail occasionally. Support wants a clear rule for what happens next.',
      options: [
        {
          id: 'manual-partial-success',
          label: 'Keep the order and handle failures manually later',
          description: 'Let the order continue and absorb cleanup through operations.',
          rationale: 'This keeps orders moving, but it pushes hidden debt into the team.',
          effects: {
            hidden: { resilience: -1, operability: -1, complexity: -1 },
            budget: 1,
            tags: ['partial-manual'],
          },
          playerFeedback: {
            narrative: [
              'The team accepted partial success and left cleanup to operations.',
              'That keeps orders moving, but it pushes the burden into support and incident handling.',
            ],
            status: [
              'No visible incident',
              'Manual recovery burden increased',
              'Operational resilience weakened',
            ],
          },
        },
        {
          id: 'tracked-retries',
          label: 'Track state and retry failed steps automatically',
          description: 'Keep explicit state and let the system retry unfinished work.',
          rationale: 'This is more involved, but it makes async behavior survivable under pressure.',
          effects: {
            hidden: { resilience: 2, operability: 1, complexity: 1 },
            budget: 3,
            tags: ['tracked-retries'],
          },
          playerFeedback: {
            narrative: [
              'The team made failure states explicit and added recovery logic for unfinished work.',
              'That is more complex, but it gives the system a way to survive instability.',
            ],
            status: [
              'No visible incident',
              'Recovery capability improved',
              'Coordination complexity increased slightly',
            ],
          },
        },
      ],
    },
    'payment-instability-spike': {
      id: 'payment-instability-spike',
      kind: 'event',
      title: 'Payment Instability + High Traffic',
      scenario: 'Traffic jumps while the payment provider becomes unstable and some requests time out.',
      tests: [
        { key: 'scalability', weight: 2 },
        { key: 'reliability', weight: 2 },
        { key: 'resilience', weight: 3 },
        { key: 'operability', weight: 1 },
        { key: 'complexity', weight: -1 },
      ],
      statFeedback: {
        scalability: {
          positive: 'The request path held up under heavier traffic.',
          negative: 'The request path slowed down as pressure increased.',
        },
        reliability: {
          positive: 'Endpoint behavior stayed predictable when requests were retried.',
          negative: 'Request handling became harder to reason about under repeated submissions.',
        },
        resilience: {
          positive: 'The system had a recovery path for incomplete work.',
          negative: 'The system had no safe way to absorb duplicate or partial processing.',
        },
        operability: {
          positive: 'The team could understand what the system was doing during the incident.',
          negative: 'Operational visibility made incident response slower and more uncertain.',
        },
        complexity: {
          positive: 'The current design kept coordination overhead manageable.',
          negative: 'Coordination overhead made the failure harder to control.',
        },
      },
      tagRules: [
        { tag: 'idempotent', score: 3, reason: 'Idempotency prevents duplicate order creation during retries.' },
        { tag: 'non-idempotent', score: -4, reason: 'Retry storms can create duplicate orders and payment confusion.' },
        { tag: 'async-processing', score: 2, reason: 'Async work removes pressure from the request path.' },
        { tag: 'sync-processing', score: -2, reason: 'Synchronous coordination amplifies provider instability.' },
        { tag: 'tracked-retries', score: 2, reason: 'Tracked retries recover incomplete background work.' },
        { tag: 'partial-manual', score: -2, reason: 'Manual recovery creates operational backlog during the spike.' },
      ],
      thresholds: {
        success: 10,
        partial: 3,
      },
      outcomes: {
        success: {
          visible: { businessHealth: 2, momentum: 1 },
          summary: 'The system absorbs the spike and recovers incomplete work without customer-visible damage.',
        },
        partial: {
          visible: { systemHealth: -1, businessHealth: -1, momentum: -1 },
          summary: 'Orders keep flowing, but recovery is messy and support load rises.',
        },
        failure: {
          visible: { systemHealth: -3, businessHealth: -2, momentum: -1 },
          summary: 'Timeouts, duplicates, and recovery gaps turn the spike into a business incident.',
        },
      },
    },
  },
}
