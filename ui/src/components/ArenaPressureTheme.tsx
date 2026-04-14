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
    <div className={`arena-pressure-theme ${level}`} aria-hidden="true">
      <div className="arena-pressure-vignette" />
      <div className="arena-pressure-scanlines" />
      <div className="arena-pressure-grid" />
      <div className="arena-pressure-edge-glow" />
    </div>
  )
}
