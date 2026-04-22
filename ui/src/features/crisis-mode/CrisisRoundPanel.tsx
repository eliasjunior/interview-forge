import './CrisisRoundPanel.css'
import type { MouseEvent } from 'react'
import type { ArenaAction } from '../../crisis/topicArena'
import {
  gradeBadge,
  IMPROVEMENT_BONUS,
  OUTCOME_EFFECTS,
  OUTCOME_LABELS,
  getOutcomeTone,
  shouldAwardImprovementBonus,
} from './model'
import type { useCrisisMode } from './useCrisisMode'

type CrisisModeState = ReturnType<typeof useCrisisMode>

type CrisisRoundPanelProps = {
  state: CrisisModeState
}

function chipToneClass(tone: ReturnType<typeof getOutcomeTone>) {
  if (tone === 'success') return 'crisis-round__chip--success'
  if (tone === 'mixed') return 'crisis-round__chip--mixed'
  return 'crisis-round__chip--danger'
}

export default function CrisisRoundPanel({ state }: CrisisRoundPanelProps) {
  const {
    scenario,
    scenarios,
    roundIndex,
    runStarted,
    timer,
    selectedActionId,
    selectedAction,
    bestMoveId,
    latestArtifact,
    followupPrompt,
    finished,
    twistPrompt,
    interviewState,
    firstAssessment,
    secondAssessment,
    improvementDelta,
    actionHandlers,
  } = state

  if (!scenario) return null

  async function handleActionClick(action: ArenaAction, event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    await actionHandlers.handleActionSelect(action, {
      top: rect.top + rect.height / 2 - 18,
      left: rect.right + 16,
    })
  }

  return (
    <div className="crisis-round card">
      <div className="crisis-round__header">
        <div>
          <div className="crisis-round__eyebrow">
            Round {roundIndex + 1} / {scenarios.length}
          </div>
          <h2 className="crisis-round__title">{scenario.title}</h2>
        </div>
        <div className="crisis-round__stage">{scenario.stage} stage · topic-backed drill</div>
      </div>

      {!runStarted ? (
        <div className="crisis-round__ready">
          <div className="crisis-round__section-label">Run ready</div>
          <h3 className="crisis-round__ready-title">Start the run to reveal this crisis</h3>
          <p className="crisis-round__ready-copy">
            The question, trade-off context, and decision options stay hidden until the countdown is armed.
          </p>
        </div>
      ) : (
        <>
          <p className="crisis-round__prompt">{scenario.prompt}</p>

          <div className="crisis-round__context-list">
            <div className="crisis-round__context-item">Topic file: {scenario.topicFile}</div>
            <div className="crisis-round__context-item">Stage: {scenario.stage}</div>
            <div className="crisis-round__context-item">Authored question: #{scenario.sourceQuestionIndex + 1}</div>
          </div>

          <div className="crisis-round__actions">
            {scenario.actions.map((action) => {
              const isSelected = selectedActionId === action.id
              const revealBest = selectedActionId !== null && action.id === bestMoveId

              return (
                <button
                  key={action.id}
                  className={[
                    'crisis-round__action-card',
                    isSelected ? 'crisis-round__action-card--selected' : '',
                    revealBest ? 'crisis-round__action-card--best' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={(event) => void handleActionClick(action, event)}
                  disabled={selectedActionId !== null}
                >
                  <div className="crisis-round__action-top">
                    <span className="crisis-round__action-name">{action.label}</span>
                    {isSelected ? (
                      <span className={`crisis-round__chip ${chipToneClass(getOutcomeTone(action.outcome))}`}>{OUTCOME_LABELS[action.outcome]}</span>
                    ) : null}
                    {!isSelected && revealBest ? <span className="crisis-round__chip crisis-round__chip--success">Best first move</span> : null}
                  </div>
                  <div className="crisis-round__action-copy">{action.rationale}</div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {selectedAction && latestArtifact ? (
        <div className="crisis-round__result">
          <div className="crisis-round__result-header">
            <div>
              <div className="crisis-round__section-label">Round feedback</div>
              <h3>{OUTCOME_LABELS[selectedAction.outcome]}</h3>
            </div>
            <div className="crisis-round__score">+{OUTCOME_EFFECTS[selectedAction.outcome].score + timer} pts</div>
          </div>

          <p className="crisis-round__result-copy">{latestArtifact.evaluation.reason}</p>

          <div className="crisis-round__effect-list">
            <span className="crisis-round__effect-item">Outcome {latestArtifact.evaluation.roundOutcome}</span>
            <span className="crisis-round__effect-item">Time left {latestArtifact.signals.timeRemainingSec}s</span>
            <span className="crisis-round__effect-item">Confidence {latestArtifact.signals.confidence ?? 'unknown'}</span>
            <span className="crisis-round__effect-item">Concepts {scenario.expectedConcepts.map((concept) => concept.label).slice(0, 3).join(', ')}</span>
          </div>

          <div className="crisis-round__followup">
            <div className="crisis-round__section-label">Scoped follow-up prompt</div>
            <pre className="crisis-round__followup-prompt">{followupPrompt}</pre>

            {!interviewState.interviewStarted ? (
              <div className="crisis-round__actions-row">
                <button className="btn-secondary" onClick={actionHandlers.handleStartInterview}>
                  Start interview from this decision
                </button>
                <button className="btn-secondary" onClick={() => void actionHandlers.handleCopyPrompt()}>
                  {interviewState.copied ? 'Copied prompt' : 'Copy prompt'}
                </button>
                {finished ? (
                  <button className="btn-secondary" onClick={actionHandlers.handleReset}>Play again</button>
                ) : (
                  <button className="btn-secondary" onClick={actionHandlers.handleNextRound}>Next crisis</button>
                )}
              </div>
            ) : (
              <div className="crisis-round__flow">
                <div className="crisis-round__interview-header">
                  <div>
                    <div className="crisis-round__section-label">Follow-up interview</div>
                    <h3 className="crisis-round__headline">Defend your decision</h3>
                  </div>
                  <div
                    className={[
                      'crisis-round__mini-timer',
                      interviewState.followupTimer <= 8 && !interviewState.firstAttempt ? 'crisis-round__mini-timer--danger' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {interviewState.firstAttempt ? `Answered in ${interviewState.firstAttempt.timeSpentSec}s` : `⏱ ${interviewState.followupTimer}s`}
                  </div>
                </div>

                {!interviewState.firstAttempt ? (
                  <div className="crisis-round__interview-card">
                    <textarea
                      className="crisis-round__input"
                      value={interviewState.answerDraft}
                      onChange={(event) => actionHandlers.setAnswerDraft(event.target.value)}
                      placeholder="Answer like a candidate in a system design interview. Name the bottleneck, the trade-off, the API shape, and what you would measure next."
                    />
                    <div className="crisis-round__actions-row">
                      <button
                        className="btn-secondary"
                        onClick={actionHandlers.handleSubmitFirstAttempt}
                        disabled={interviewState.answerDraft.trim().length < 40}
                      >
                        Submit answer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="crisis-round__stack">
                    <div className="crisis-round__grade-card">
                      <div className="crisis-round__grade-header">
                        <div>
                          <div className="crisis-round__section-label">Grade shown</div>
                          <h3 className="crisis-round__grade">{gradeBadge(interviewState.firstAttempt.grade)} {interviewState.firstAttempt.grade}</h3>
                        </div>
                        <div className="crisis-round__bonus">
                          <div>⏱ Answer time: {interviewState.firstAttempt.timeSpentSec}s</div>
                          <div>⚡ Bonus: +{interviewState.firstAttempt.fastBonus} (fast response)</div>
                        </div>
                      </div>
                      <div className="crisis-round__feedback">
                        <strong>{interviewState.firstAttempt.grade === 'Strong' ? 'Strong' : interviewState.firstAttempt.grade === 'Decent' ? 'Decent — but incomplete' : 'Weak — missing key trade-offs'}</strong>
                        <p>Covered: {(firstAssessment?.covered ?? []).join(', ') || 'none yet'}</p>
                        <p>Missed: {(firstAssessment?.missed.slice(0, 3) ?? []).join(', ') || 'none'}</p>
                      </div>
                      <div className="crisis-round__keyword-hits">
                        {(firstAssessment?.covered ?? []).map((hit) => (
                          <span key={hit} className="crisis-round__chip crisis-round__chip--success">{hit}</span>
                        ))}
                      </div>
                    </div>

                    {interviewState.firstAttempt.grade !== 'Strong' && !interviewState.secondAttempt ? (
                      <div className="crisis-round__grade-card">
                        <div className="crisis-round__section-label">Improve your answer</div>
                        <h3 className="crisis-round__headline">Improve answer (+20 pts if better)</h3>
                        <textarea
                          className="crisis-round__input"
                          value={interviewState.improvedDraft}
                          onChange={(event) => actionHandlers.setImprovedDraft(event.target.value)}
                          placeholder="Use the feedback. Tighten the trade-off explanation and address the missing piece explicitly."
                        />
                        <div className="crisis-round__actions-row">
                          <button
                            className="btn-secondary"
                            onClick={actionHandlers.handleSubmitImprovedAnswer}
                            disabled={interviewState.improvedDraft.trim().length < 40}
                          >
                            Improve answer (+20 pts if better)
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {interviewState.secondAttempt && secondAssessment ? (
                      <div className="crisis-round__grade-card">
                        <div className="crisis-round__grade-header">
                          <div>
                            <div className="crisis-round__section-label">Attempt comparison</div>
                            <h3 className="crisis-round__grade">
                              {interviewState.firstAttempt.coverageCount}/{scenario.expectedConcepts.length} → {interviewState.secondAttempt.coverageCount}/{scenario.expectedConcepts.length}
                            </h3>
                          </div>
                          <div className="crisis-round__bonus">
                            <div>Second answer time: {interviewState.secondAttempt.timeSpentSec}s</div>
                            <div>Improvement: {improvementDelta >= 0 ? '+' : ''}{improvementDelta}</div>
                            <div>⚡ Bonus: +{interviewState.secondAttempt.fastBonus}</div>
                            <div>
                              🎯 Retry bonus: {shouldAwardImprovementBonus(interviewState.firstAttempt, interviewState.secondAttempt) ? `+${IMPROVEMENT_BONUS}` : '+0'}
                            </div>
                          </div>
                        </div>
                        <p className="crisis-round__copy">{gradeBadge(interviewState.secondAttempt.grade)} {interviewState.secondAttempt.grade}</p>
                        {shouldAwardImprovementBonus(interviewState.firstAttempt, interviewState.secondAttempt) ? (
                          <p className="crisis-round__copy">+20 pts — better coverage.</p>
                        ) : (
                          <p className="crisis-round__copy">Coverage did not improve enough for the bonus.</p>
                        )}
                      </div>
                    ) : null}

                    {interviewState.twistUnlocked ? (
                      <div className="crisis-round__twist-card">
                        <div className="crisis-round__section-label">Twist</div>
                        <h3 className="crisis-round__headline">Adapt your answer</h3>
                        <p className="crisis-round__copy">{twistPrompt}</p>
                        {!interviewState.twistAnswered ? (
                          <>
                            <textarea
                              className="crisis-round__input"
                              value={interviewState.twistAnswer}
                              onChange={(event) => actionHandlers.setTwistAnswer(event.target.value)}
                              placeholder="Answer the twist in 2-4 lines."
                            />
                            <div className="crisis-round__actions-row">
                              <button
                                className="btn-secondary"
                                onClick={() => actionHandlers.setTwistAnswered(true)}
                                disabled={interviewState.twistAnswer.trim().length < 20}
                              >
                                Submit twist answer
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="crisis-round__copy">Twist answered. Round complete.</p>
                        )}
                      </div>
                    ) : null}

                    <div className="crisis-round__actions-row">
                      <button className="btn-secondary" onClick={() => void actionHandlers.handleCopyPrompt()}>
                        {interviewState.copied ? 'Copied prompt' : 'Copy prompt'}
                      </button>
                      {finished ? (
                        <button className="btn-secondary" onClick={actionHandlers.handleReset}>Play again</button>
                      ) : (
                        <button className="btn-secondary" onClick={actionHandlers.handleNextRound}>Next crisis</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
