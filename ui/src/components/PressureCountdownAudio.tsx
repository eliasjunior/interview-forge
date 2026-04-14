import { useEffect, useRef } from 'react'
import { playCrisisAudioCue, subscribeToCrisisAudioUnlock } from '../audio/crisisAudio'

type PressureCountdownAudioProps = {
  active: boolean
  secondsRemaining: number | null
}

export default function PressureCountdownAudio({
  active,
  secondsRemaining,
}: PressureCountdownAudioProps) {
  const activeRef = useRef(active)
  const secondsRemainingRef = useRef(secondsRemaining)
  const lastPlayedSecondRef = useRef<number | null>(null)

  useEffect(() => {
    activeRef.current = active
    secondsRemainingRef.current = secondsRemaining
  }, [active, secondsRemaining])

  useEffect(() => {
    const unsubscribe = subscribeToCrisisAudioUnlock(() => {
      const currentSecond = secondsRemainingRef.current
      if (!activeRef.current || currentSecond == null || currentSecond <= 0) return
      if (lastPlayedSecondRef.current === currentSecond) return

      const played = playCrisisAudioCue('pressureTick')
      if (played) lastPlayedSecondRef.current = currentSecond
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!active || secondsRemaining == null || secondsRemaining <= 0) {
      lastPlayedSecondRef.current = null
      return
    }

    if (lastPlayedSecondRef.current === secondsRemaining) return

    const played = playCrisisAudioCue('pressureTick')
    if (played) lastPlayedSecondRef.current = secondsRemaining
  }, [active, secondsRemaining])

  return null
}
