import './CrisisSidebar.css'
import { gradeBadge, getHealthLabel, OUTCOME_LABELS } from './model'
import type { useCrisisMode } from './useCrisisMode'

type CrisisModeState = ReturnType<typeof useCrisisMode>

type CrisisSidebarProps = {
  state: CrisisModeState
}

export default function CrisisSidebar({ state }: CrisisSidebarProps) {
  const {
    score,
    metrics,
    interviewReadiness,
    latestArtifact,
    roundGrade,
    scenario,
    improveUsed,
    history,
    interviewState,
  } = state

  return (
    <aside className="crisis-mode__sidebar">
      <div className="crisis-sidebar card">
        <div className="crisis-sidebar__panel-title">Run status</div>
        <div className="crisis-sidebar__score">{score}</div>
        <div className="crisis-sidebar__score-label">Total score</div>

        <div className="crisis-sidebar__metrics">
          {([
            ['latency', 'Latency'],
            ['reliability', 'Reliability'],
            ['cost', 'Cost control'],
            ['confidence', 'Interview confidence'],
          ] as const).map(([key, label]) => (
            <div key={key} className="crisis-sidebar__metric">
              <div className="crisis-sidebar__metric-meta">
                <span>{label}</span>
                <strong>{metrics[key]}</strong>
              </div>
              <div className="crisis-sidebar__metric-track">
                <div className="crisis-sidebar__metric-fill" style={{ width: `${metrics[key]}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="crisis-sidebar__readiness">
          <div className="crisis-sidebar__section-label">Panel read</div>
          <div className="crisis-sidebar__readiness-score">{interviewReadiness}</div>
          <div className="crisis-sidebar__readiness-copy">{getHealthLabel(interviewReadiness)} design signal</div>
        </div>

        {latestArtifact && scenario ? (
          <div className="crisis-sidebar__artifact">
            <div className="crisis-sidebar__section-label">Round progress</div>
            <div className="crisis-sidebar__artifact-copy">Decision: {latestArtifact.selectedActionLabel}</div>
            <div className="crisis-sidebar__artifact-copy">Grade: {roundGrade ? `${gradeBadge(roundGrade)} ${roundGrade}` : 'Not graded yet'}</div>
            <div className="crisis-sidebar__artifact-copy">
              Concept coverage: {interviewState.secondAttempt?.coverageCount ?? interviewState.firstAttempt?.coverageCount ?? 0}/{scenario.expectedConcepts.length}
            </div>
            <div className="crisis-sidebar__artifact-copy">Improve used: {improveUsed ? 'yes' : 'no'}</div>
            <div className="crisis-sidebar__artifact-copy">Twist answered: {interviewState.twistAnswered ? 'yes' : 'no'}</div>
          </div>
        ) : null}
      </div>

      <div className="crisis-history card">
        <div className="crisis-sidebar__panel-title">Decision trail</div>
        {history.length === 0 ? (
          <div className="crisis-history__empty">Your round choices will stack here.</div>
        ) : (
          <div className="crisis-history__list">
            {history.map((entry, index) => (
              <div key={`${entry.scenario}-${index}`} className="crisis-history__item">
                <div className="crisis-history__step">R{index + 1}</div>
                <div>
                  <div className="crisis-history__scenario">{entry.scenario}</div>
                  <div className="crisis-history__action">{entry.action}</div>
                  <div className="crisis-history__action">{OUTCOME_LABELS[entry.outcome]}</div>
                </div>
                <div className="crisis-history__score">+{entry.score}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
