export const PRESSURE_THRESHOLD_SEC = 15

export type PressureLevel = 'warning' | 'final' | 'critical'

export function getPressureLevel(secondsRemaining: number, threshold = PRESSURE_THRESHOLD_SEC): PressureLevel | null {
  if (secondsRemaining > threshold || secondsRemaining <= 0) return null
  if (secondsRemaining <= 5) return 'critical'
  if (secondsRemaining <= 10) return 'final'
  return 'warning'
}

export function isPressureActive(secondsRemaining: number | null, threshold = PRESSURE_THRESHOLD_SEC) {
  if (secondsRemaining == null) return false
  return getPressureLevel(secondsRemaining, threshold) !== null
}
