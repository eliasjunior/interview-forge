type ArenaPressureFxProps = {
  enabled: boolean
  secondsRemaining: number | null
  threshold?: number
}

function getPressureLevel(secondsRemaining: number, threshold: number) {
  if (secondsRemaining > threshold) return null
  if (secondsRemaining <= 5) return 'critical'
  if (secondsRemaining <= 10) return 'final'
  return 'warning'
}

export default function ArenaPressureFx({
  enabled,
  secondsRemaining,
  threshold = 20,
}: ArenaPressureFxProps) {
  if (!enabled || secondsRemaining == null || secondsRemaining <= 0) return null

  const level = getPressureLevel(secondsRemaining, threshold)
  if (!level) return null

  return (
    <div className={`arena-pressure-fx ${level}`} aria-hidden="true">
      <div className="arena-pressure-vignette" />
      <div className="arena-pressure-scanlines" />
    </div>
  )
}
