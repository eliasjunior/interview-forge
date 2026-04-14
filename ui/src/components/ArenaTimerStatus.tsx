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
    return <div className="arena-timer">Locked</div>
  }

  if (!armed) {
    return <div className="arena-timer">Ready</div>
  }

  const pressureLevel = getPressureLevel(secondsRemaining, PRESSURE_THRESHOLD_SEC)

  if (!pressureLevel) {
    return <div className="arena-timer">{secondsRemaining}s</div>
  }

  return (
    <div className={`arena-timer arena-timer-pressure ${pressureLevel}`}>
      <span className="arena-pressure-label">Pressure rising</span>
      <strong>{secondsRemaining}s</strong>
    </div>
  )
}
