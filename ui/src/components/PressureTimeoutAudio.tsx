import { useEffect, useRef } from 'react'
import { playCrisisAudioCue, subscribeToCrisisAudioUnlock } from '../audio/crisisAudio'

type PressureTimeoutAudioProps = {
  armed: boolean
  secondsRemaining: number | null
}

export default function PressureTimeoutAudio({
  armed,
  secondsRemaining,
}: PressureTimeoutAudioProps) {
  const previousSecondsRef = useRef<number | null>(secondsRemaining)
  const pendingTimeoutRef = useRef(false)

  useEffect(() => {
    const unsubscribe = subscribeToCrisisAudioUnlock(() => {
      if (!pendingTimeoutRef.current) return
      const played = playCrisisAudioCue('pressureTimeout')
      if (played) pendingTimeoutRef.current = false
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    const previousSeconds = previousSecondsRef.current
    previousSecondsRef.current = secondsRemaining

    if (!armed) {
      pendingTimeoutRef.current = false
      return
    }

    const timedOut = secondsRemaining === 0 && previousSeconds != null && previousSeconds > 0
    if (!timedOut) return

    const played = playCrisisAudioCue('pressureTimeout')
    pendingTimeoutRef.current = !played
  }, [armed, secondsRemaining])

  return null
}
