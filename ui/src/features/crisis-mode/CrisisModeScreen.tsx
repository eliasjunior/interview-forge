import './CrisisModeScreen.css'
import ArenaPressureTheme from '../../components/ArenaPressureTheme'
import ArenaTimerStatus from '../../components/ArenaTimerStatus'
import CrisisAudioBootstrap from '../../components/CrisisAudioBootstrap'
import FailureFlashFx from '../../components/FailureFlashFx'
import PressureCountdownAudio from '../../components/PressureCountdownAudio'
import PressureTimeoutAudio from '../../components/PressureTimeoutAudio'
import RewardBurstFx from '../../components/RewardBurstFx'
import CrisisRoundPanel from './CrisisRoundPanel'
import CrisisSidebar from './CrisisSidebar'
import { useCrisisMode } from './useCrisisMode'

export default function CrisisModeScreen() {
  const state = useCrisisMode()

  if (state.loading) return <div className="page-loading">Loading Crisis Mode...</div>
  if (state.error || !state.scenario || !state.topicDetails) {
    return <div className="error-msg">Failed to load Crisis Mode: {state.error ?? 'Missing topic data.'}</div>
  }

  return (
    <div className="crisis-mode">
      <CrisisAudioBootstrap />
      <ArenaPressureTheme active={state.pressureActive} secondsRemaining={state.pressureCountdown} />
      <PressureCountdownAudio active={state.pressureActive} secondsRemaining={state.pressureCountdown} />
      <PressureTimeoutAudio armed={state.pressureCountdown !== null} secondsRemaining={state.pressureCountdown} />
      <FailureFlashFx armed={state.pressureCountdown !== null} secondsRemaining={state.pressureCountdown} />
      <RewardBurstFx
        animationKey={state.floatingAnimationKey}
        points={state.floatingPoints}
        tone={state.floatingTone}
        position={state.floatingPosition}
      />
      <div className="crisis-mode__hero card">
        <div>
          <div className="crisis-mode__eyebrow">{state.topicDetails.topic}</div>
          <h1 className="crisis-mode__title">Crisis Mode</h1>
          <p className="crisis-mode__subtitle">
            One topic file drives this entire challenge. The round order is shuffled, but the feedback
            comes from explicit concepts taken from the authored trade-offs in that topic.
          </p>
        </div>
        <div className="crisis-mode__hero-actions">
          <ArenaTimerStatus secondsRemaining={state.timer} locked={state.selectedAction !== null} armed={state.runStarted} />
          <button className="btn-secondary" onClick={state.runStarted ? state.actionHandlers.handleReset : state.actionHandlers.handleStartRun}>
            {state.runStarted ? 'Restart run' : 'Start run'}
          </button>
        </div>
      </div>

      <div className="crisis-mode__layout">
        <section className="crisis-mode__main">
          <CrisisRoundPanel state={state} />
        </section>
        <CrisisSidebar state={state} />
      </div>
    </div>
  )
}
