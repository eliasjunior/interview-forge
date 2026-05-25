import './SimulationScreen.css'
import { useMemo, useState } from 'react'
import {
  asDecisionCard,
  asEventCard,
  continueRun,
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

  const currentCard = useMemo(() => getCurrentCard(orderCreationSubject, run), [run])
  const decisionCard = asDecisionCard(currentCard)
  const eventCard = asEventCard(currentCard)
  const complete = isRunComplete(run)
  const latestLog: TurnLog<OrderVisibleKey, OrderHiddenKey, OrderTag> | null =
    run.log.length > 0 ? run.log[run.log.length - 1] : null
  const decisionResolution = run.currentDecisionResolution
  const eventResolution = run.currentEventResolution
  const decisionResultCard = decisionResolution ? asDecisionCard(orderCreationSubject.cards[decisionResolution.cardId]) : null
  const decisionResultOption = decisionResultCard?.options.find((candidate) => candidate.id === decisionResolution?.optionId) ?? null

  function handleChoose(optionId: string) {
    if (!decisionCard) return
    const result = resolveDecision(orderCreationSubject, run, optionId)
    setRun(result.run)
  }

  function handleResolveEvent() {
    if (!eventCard) return
    const result = resolveEvent(orderCreationSubject, run)
    setRun(result.run)
  }

  function handleRestart() {
    setRun(createRunState(orderCreationSubject))
  }

  function handleContinue() {
    setRun((current) => continueRun(orderCreationSubject, current))
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
            Round {Math.min(run.roundIndex + 1, orderCreationSubject.rounds.length)} / {orderCreationSubject.rounds.length}
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
          {decisionResolution && decisionResultCard && decisionResultOption && (run.phase === 'decision_result' || run.phase === 'followup_result') ? (
            <div className="simulation-card card">
              <div className="simulation-card__eyebrow">QuickCart 🚀</div>
              <h2 className="simulation-card__title">Round {run.roundIndex + 1} — Decision Applied</h2>

              <div className="simulation-inline-stats">
                <span>[System] {run.visible.systemHealth}/10</span>
                <span>[Business] {run.visible.businessHealth}/10</span>
                <span>[Momentum] {run.visible.momentum}</span>
              </div>

              <div className="simulation-result-lock">
                <div className="simulation-result-lock__label">Decision locked in:</div>
                <div className="simulation-result-lock__value">→ {decisionResultOption.label}</div>
              </div>

              <div className="simulation-result-block">
                <div className="simulation-result-block__label">Narrative:</div>
                {(decisionResultOption.playerFeedback?.narrative ?? [decisionResultOption.rationale]).map((line) => (
                  <p key={line} className="simulation-card__scenario">{line}</p>
                ))}
              </div>

              <div className="simulation-result-block">
                <div className="simulation-result-block__label">Status:</div>
                <ul className="simulation-status-list">
                  {(decisionResultOption.playerFeedback?.status ?? ['Decision recorded']).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              {showDebug ? (
                <div className="simulation-result-block simulation-result-block--debug">
                  <div className="simulation-result-block__label">Debug traits:</div>
                  <ul className="simulation-status-list">
                    {Object.entries(decisionResultOption.effects.hidden ?? {}).length === 0 ? (
                      <li>No hidden trait changes</li>
                    ) : (
                      Object.entries(decisionResultOption.effects.hidden ?? {}).map(([key, value]) => (
                        <li key={key}>
                          {formatLabel(key)} {value >= 0 ? '+' : ''}{value}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : null}

              <div className="simulation-actions">
                <button className="btn-secondary" onClick={handleContinue}>Continue</button>
              </div>
            </div>
          ) : eventResolution && eventCard && run.phase === 'event_result' ? (
            <div className="simulation-card card">
              <div className="simulation-card__eyebrow">QuickCart 🚀</div>
              <h2 className="simulation-card__title">Round {run.roundIndex + 1} — Event</h2>

              <div className="simulation-inline-stats">
                <span>[System] {eventResolution.visibleBefore.systemHealth}/10</span>
                <span>[Business] {eventResolution.visibleBefore.businessHealth}/10</span>
                <span>[Momentum] {eventResolution.visibleBefore.momentum}</span>
              </div>

              <div className="simulation-result-block">
                <div className="simulation-result-block__label">Event: {eventCard.title}</div>
                <p className="simulation-card__scenario">{eventCard.scenario}</p>
              </div>

              <div className="simulation-result-block">
                <div className="simulation-result-block__label">Contributors:</div>
                <ul className="simulation-status-list">
                  {eventResolution.contributors
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
                    .filter((value): value is string => Boolean(value))
                    .map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="simulation-result-block">
                <div className="simulation-result-block__label">
                  Outcome: {eventResolution.outcome === 'partial' ? 'Partial Failure' : eventResolution.outcome === 'success' ? 'Success' : 'Failure'}
                </div>
                <p className="simulation-card__scenario">{eventResolution.summary}</p>
              </div>

              <div className="simulation-result-block">
                <div className="simulation-result-block__label">Effects:</div>
                <ul className="simulation-status-list">
                  <li>System Health: {eventResolution.visibleBefore.systemHealth} → {eventResolution.visibleAfter.systemHealth}</li>
                  <li>Business Health: {eventResolution.visibleBefore.businessHealth} → {eventResolution.visibleAfter.businessHealth}</li>
                  <li>Momentum: {eventResolution.visibleBefore.momentum} → {eventResolution.visibleAfter.momentum}</li>
                </ul>
              </div>

              <div className="simulation-actions">
                <button className="btn-secondary" onClick={handleContinue}>Continue</button>
              </div>
            </div>
          ) : decisionCard ? (
            <div className="simulation-card card">
              <div className="simulation-card__eyebrow">Decision</div>
              <h2 className="simulation-card__title">Round {run.roundIndex + 1} — {decisionCard.title}</h2>
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

          {eventCard && run.phase === 'event_preview' ? (
            <div className="simulation-card card">
              <div className="simulation-card__eyebrow">QuickCart 🚀</div>
              <h2 className="simulation-card__title">Round {run.roundIndex + 1} — Event</h2>
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

          {complete ? (
            <div className="simulation-card card">
              <div className="simulation-card__eyebrow">Run complete</div>
              <h2 className="simulation-card__title">First simulation playable</h2>
              <p className="simulation-card__scenario">
                This run is finished. Restart to try a different architecture path.
              </p>
            </div>
          ) : null}

          {latestLog?.kind === 'event' && run.phase === 'complete' ? (
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
