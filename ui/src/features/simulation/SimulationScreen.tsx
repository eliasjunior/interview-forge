import './SimulationScreen.css'
import { useMemo, useState } from 'react'
import {
  asDecisionCard,
  asEventCard,
  createRunState,
  getCurrentCard,
  isRunComplete,
  resolveDecision,
  resolveEvent,
} from '../../game/engine'
import { orderCreationSubject } from '../../game/content/orderCreation'
import type { RunState, TurnLog } from '../../game/types'
import type { OrderHiddenKey, OrderTag, OrderVisibleKey } from '../../game/content/orderCreation'

type OrderRunState = RunState<OrderVisibleKey, OrderHiddenKey, OrderTag>
type DecisionResultView = {
  cardTitle: string
  roundLabel: string
  optionLabel: string
  narrative: string[]
  status: string[]
  hiddenEffects: Partial<Record<OrderHiddenKey, number>>
}

type EventResultView = {
  cardTitle: string
  roundLabel: string
  scenario: string
  outcome: string
  summary: string
  contributors: string[]
  visibleBefore: Record<OrderVisibleKey, number>
  visibleAfter: Record<OrderVisibleKey, number>
}

function formatLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
}

function contributorTone(contribution: number) {
  if (contribution > 0) return 'good'
  if (contribution < 0) return 'bad'
  return 'neutral'
}

export default function SimulationScreen() {
  const [run, setRun] = useState<OrderRunState>(() => createRunState(orderCreationSubject))
  const [showDebug, setShowDebug] = useState(false)
  const [decisionResultView, setDecisionResultView] = useState<DecisionResultView | null>(null)
  const [eventResultView, setEventResultView] = useState<EventResultView | null>(null)

  const currentCard = useMemo(() => getCurrentCard(orderCreationSubject, run), [run])
  const decisionCard = asDecisionCard(currentCard)
  const eventCard = asEventCard(currentCard)
  const complete = isRunComplete(run)
  const latestLog: TurnLog<OrderVisibleKey, OrderHiddenKey, OrderTag> | null =
    run.log.length > 0 ? run.log[run.log.length - 1] : null

  function handleChoose(optionId: string) {
    if (!decisionCard) return
    const option = decisionCard.options.find((candidate) => candidate.id === optionId)
    if (!option) return

    const result = resolveDecision(orderCreationSubject, run, optionId)
    setRun(result.run)
    setDecisionResultView({
      cardTitle: decisionCard.title,
      roundLabel: `Round ${run.log.length + 1} — Decision Applied`,
      optionLabel: option.label,
      narrative: option.playerFeedback?.narrative ?? [option.rationale],
      status: option.playerFeedback?.status ?? ['Decision recorded'],
      hiddenEffects: option.effects.hidden ?? {},
    })
  }

  function handleResolveEvent() {
    if (!eventCard) return
    const result = resolveEvent(orderCreationSubject, run)
    setRun(result.run)
    setEventResultView({
      cardTitle: eventCard.title,
      roundLabel: `Round ${run.log.length + 1} — Event`,
      scenario: eventCard.scenario,
      outcome: result.resolution.outcome === 'partial' ? 'Partial Failure' : result.resolution.outcome === 'success' ? 'Success' : 'Failure',
      summary: result.resolution.summary,
      contributors: result.resolution.contributors
        .map((contributor) => {
          if (contributor.type === 'tag') {
            return `${contributor.contribution >= 0 ? '+' : '-'} ${contributor.reason}`
          }

          if (contributor.contribution === 0) return null

          const feedback = eventCard.statFeedback?.[contributor.key]
          if (!feedback) {
            return `${contributor.contribution >= 0 ? '+' : '-'} ${formatLabel(contributor.key)} influenced the outcome`
          }

          return `${contributor.contribution >= 0 ? '+' : '-'} ${contributor.contribution >= 0 ? feedback.positive : feedback.negative}`
        })
        .filter((value): value is string => Boolean(value)),
      visibleBefore: result.resolution.visibleBefore,
      visibleAfter: result.resolution.visibleAfter,
    })
  }

  function handleRestart() {
    setRun(createRunState(orderCreationSubject))
    setDecisionResultView(null)
    setEventResultView(null)
  }

  return (
    <div className="simulation-screen">
      <header className="simulation-hero card">
        <div>
          <div className="simulation-hero__eyebrow">Prototype 2 MVP</div>
          <h1 className="simulation-hero__title">{orderCreationSubject.title}</h1>
          <p className="simulation-hero__copy">
            Decisions stack into follow-ups, then the event tests the whole design under pressure.
          </p>
        </div>
        <div className="simulation-hero__actions">
          <div className="simulation-pill">
            Step {Math.min(run.currentCardIndex + 1, run.queue.length)} / {run.queue.length}
          </div>
          <label className="simulation-debug-toggle">
            <input
              type="checkbox"
              checked={showDebug}
              onChange={(event) => setShowDebug(event.target.checked)}
            />
            <span>Debug mode</span>
          </label>
          <button className="btn-secondary" onClick={handleRestart}>Restart run</button>
        </div>
      </header>

      <div className="simulation-layout">
        <section className="simulation-main">
          {decisionResultView ? (
            <div className="simulation-card card">
              <div className="simulation-card__eyebrow">QuickCart 🚀</div>
              <h2 className="simulation-card__title">{decisionResultView.roundLabel}</h2>

              <div className="simulation-inline-stats">
                <span>[System] {run.visible.systemHealth}/10</span>
                <span>[Business] {run.visible.businessHealth}/10</span>
                <span>[Momentum] {run.visible.momentum}</span>
              </div>

              <div className="simulation-result-lock">
                <div className="simulation-result-lock__label">Decision locked in:</div>
                <div className="simulation-result-lock__value">→ {decisionResultView.optionLabel}</div>
              </div>

              <div className="simulation-result-block">
                <div className="simulation-result-block__label">Narrative:</div>
                {decisionResultView.narrative.map((line) => (
                  <p key={line} className="simulation-card__scenario">{line}</p>
                ))}
              </div>

              <div className="simulation-result-block">
                <div className="simulation-result-block__label">Status:</div>
                <ul className="simulation-status-list">
                  {decisionResultView.status.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              {showDebug ? (
                <div className="simulation-result-block simulation-result-block--debug">
                  <div className="simulation-result-block__label">Debug traits:</div>
                  <ul className="simulation-status-list">
                    {Object.entries(decisionResultView.hiddenEffects).length === 0 ? (
                      <li>No hidden trait changes</li>
                    ) : (
                      Object.entries(decisionResultView.hiddenEffects).map(([key, value]) => (
                        <li key={key}>
                          {formatLabel(key)} {value >= 0 ? '+' : ''}{value}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : null}

              <div className="simulation-actions">
                <button className="btn-secondary" onClick={() => setDecisionResultView(null)}>Continue</button>
              </div>
            </div>
          ) : eventResultView ? (
            <div className="simulation-card card">
              <div className="simulation-card__eyebrow">QuickCart 🚀</div>
              <h2 className="simulation-card__title">{eventResultView.roundLabel}</h2>

              <div className="simulation-inline-stats">
                <span>[System] {eventResultView.visibleBefore.systemHealth}/10</span>
                <span>[Business] {eventResultView.visibleBefore.businessHealth}/10</span>
                <span>[Momentum] {eventResultView.visibleBefore.momentum}</span>
              </div>

              <div className="simulation-result-block">
                <div className="simulation-result-block__label">Event: {eventResultView.cardTitle}</div>
                <p className="simulation-card__scenario">{eventResultView.scenario}</p>
              </div>

              <div className="simulation-result-block">
                <div className="simulation-result-block__label">Contributors:</div>
                <ul className="simulation-status-list">
                  {eventResultView.contributors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="simulation-result-block">
                <div className="simulation-result-block__label">Outcome: {eventResultView.outcome}</div>
                <p className="simulation-card__scenario">{eventResultView.summary}</p>
              </div>

              <div className="simulation-result-block">
                <div className="simulation-result-block__label">Effects:</div>
                <ul className="simulation-status-list">
                  <li>System Health: {eventResultView.visibleBefore.systemHealth} → {eventResultView.visibleAfter.systemHealth}</li>
                  <li>Business Health: {eventResultView.visibleBefore.businessHealth} → {eventResultView.visibleAfter.businessHealth}</li>
                  <li>Momentum: {eventResultView.visibleBefore.momentum} → {eventResultView.visibleAfter.momentum}</li>
                </ul>
              </div>

              <div className="simulation-actions">
                <button className="btn-secondary" onClick={() => setEventResultView(null)}>Continue</button>
              </div>
            </div>
          ) : decisionCard ? (
            <div className="simulation-card card">
              <div className="simulation-card__eyebrow">Decision</div>
              <h2 className="simulation-card__title">Round {run.log.length + 1} — {decisionCard.title}</h2>
              <div className="simulation-inline-stats">
                <span>System Health: {run.visible.systemHealth}</span>
                <span>Business Health: {run.visible.businessHealth}</span>
                <span>Momentum: {run.visible.momentum}</span>
              </div>
              <p className="simulation-card__scenario">{decisionCard.scenario}</p>
              <div className="simulation-options">
                {decisionCard.options.map((option) => (
                  <button
                    key={option.id}
                    className="simulation-option"
                    aria-label={option.id}
                    onClick={() => handleChoose(option.id)}
                  >
                    <div className="simulation-option__header">
                      <span className="simulation-option__title">{option.label}</span>
                      <span className="simulation-option__budget">Cost {option.effects.budget ?? 0}</span>
                    </div>
                    <div className="simulation-option__copy">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!decisionResultView && !eventResultView && eventCard ? (
            <div className="simulation-card card">
              <div className="simulation-card__eyebrow">QuickCart 🚀</div>
              <h2 className="simulation-card__title">Round {run.log.length + 1} — Event</h2>
              <div className="simulation-inline-stats">
                <span>System Health: {run.visible.systemHealth}</span>
                <span>Business Health: {run.visible.businessHealth}</span>
                <span>Momentum: {run.visible.momentum}</span>
              </div>
              <div className="simulation-result-block__label">Event: {eventCard.title}</div>
              <p className="simulation-card__scenario">{eventCard.scenario}</p>
              <div className="simulation-actions">
                <button className="btn-secondary" onClick={handleResolveEvent}>Resolve event</button>
              </div>
            </div>
          ) : null}

          {!decisionResultView && !eventResultView && complete ? (
            <div className="simulation-card card">
              <div className="simulation-card__eyebrow">Run complete</div>
              <h2 className="simulation-card__title">First simulation playable</h2>
              <p className="simulation-card__scenario">
                This run is finished. Restart to try a different architecture path.
              </p>
            </div>
          ) : null}

          {!decisionResultView && !eventResultView && latestLog?.kind === 'event' ? (
            <div className="simulation-card card">
              <div className="simulation-card__eyebrow">Outcome</div>
              <h2 className="simulation-card__title">{latestLog.resolution.outcome.toUpperCase()}</h2>
              <p className="simulation-card__scenario">{latestLog.resolution.summary}</p>
              <div className="simulation-contributors">
                {latestLog.resolution.contributors.map((contributor, index) => (
                  <div
                    key={`${contributor.type}-${index}`}
                    className={`simulation-contributor simulation-contributor--${contributorTone(contributor.contribution)}`}
                  >
                    {contributor.type === 'stat' ? (
                      <>
                        <strong>{formatLabel(contributor.key)}</strong>
                        <span>
                          value {contributor.value} x {contributor.weight} = {contributor.contribution}
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>{contributor.tag}</strong>
                        <span>
                          {contributor.contribution >= 0 ? '+' : ''}{contributor.contribution} · {contributor.reason}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="simulation-sidebar">
          <div className="simulation-panel card">
            <div className="simulation-panel__title">Visible state</div>
            <div className="simulation-metrics">
              {Object.entries(run.visible).map(([key, value]) => (
                <div key={key} className="simulation-metric">
                  <span>{formatLabel(key)}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="simulation-budget">Budget remaining: {run.budget}</div>
          </div>

          {showDebug ? (
            <div className="simulation-panel card">
              <div className="simulation-panel__title">Architecture traits</div>
              <div className="simulation-metrics">
                {Object.entries(run.hidden).map(([key, value]) => (
                  <div key={key} className="simulation-metric">
                    <span>{formatLabel(key)}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="simulation-panel card">
            <div className="simulation-panel__title">Architecture traits</div>
            <div className="simulation-metrics">
              <span className="simulation-empty">
                Hidden in player view. Enable debug mode to inspect internal traits.
              </span>
            </div>
          </div>

          <div className="simulation-panel card">
            <div className="simulation-panel__title">Tags</div>
            <div className="simulation-tags">
              {run.tags.length === 0 ? (
                <span className="simulation-empty">No architecture facts recorded yet.</span>
              ) : (
                run.tags.map((tag) => (
                  <span key={tag} className="simulation-chip">
                    {tag}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="simulation-panel card">
            <div className="simulation-panel__title">Turn log</div>
            <div className="simulation-log">
              {run.log.length === 0 ? (
                <span className="simulation-empty">Your decisions and event outcomes will appear here.</span>
              ) : (
                run.log.map((entry, index) => (
                  <div key={index} className="simulation-log__item">
                    <strong>{entry.kind === 'decision' ? entry.resolution.cardId : entry.resolution.cardId}</strong>
                    <span>
                      {entry.kind === 'decision'
                        ? `option ${entry.resolution.optionId}`
                        : `outcome ${entry.resolution.outcome}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
