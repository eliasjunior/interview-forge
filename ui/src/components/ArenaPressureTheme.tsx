import './ArenaPressureTheme.css'
import { PRESSURE_THRESHOLD_SEC, getPressureLevel } from '../crisis/pressureState'

type ArenaPressureThemeProps = {
  active: boolean
  secondsRemaining: number | null
}

export default function ArenaPressureTheme({
  active,
  secondsRemaining,
}: ArenaPressureThemeProps) {
  if (!active || secondsRemaining == null) return null

  const level = getPressureLevel(secondsRemaining, PRESSURE_THRESHOLD_SEC)
  if (!level) return null

  return (
    <div className={`crisis-pressure crisis-pressure--${level}`} aria-hidden="true">
      <div className="crisis-pressure__vignette" />
      <div className="crisis-pressure__scanlines" />
      <div className="crisis-pressure__grid" />
      <div className="crisis-pressure__edge-glow" />
    </div>
  )
}
