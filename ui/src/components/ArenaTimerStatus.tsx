import './ArenaTimerStatus.css'
import { PRESSURE_THRESHOLD_SEC, getPressureLevel } from '../crisis/pressureState'

type ArenaTimerStatusProps = {
  secondsRemaining: number
  locked?: boolean
  armed?: boolean
}

export default function ArenaTimerStatus({
  secondsRemaining,
  locked = false,
  armed = true,
}: ArenaTimerStatusProps) {
  if (locked) {
    return <div className="crisis-timer">Locked</div>
  }

  if (!armed) {
    return <div className="crisis-timer">Ready</div>
  }

  const pressureLevel = getPressureLevel(secondsRemaining, PRESSURE_THRESHOLD_SEC)

  if (!pressureLevel) {
    return <div className="crisis-timer">{secondsRemaining}s</div>
  }

  return (
    <div className={`crisis-timer crisis-timer--pressure crisis-timer--${pressureLevel}`}>
      <span className="crisis-timer__label">Pressure rising</span>
      <strong>{secondsRemaining}s</strong>
    </div>
  )
}
