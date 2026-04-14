import { useEffect } from 'react'
import { mountCrisisAudio, unmountCrisisAudio } from '../audio/crisisAudio'

export default function CrisisAudioBootstrap() {
  useEffect(() => {
    mountCrisisAudio()
    return () => unmountCrisisAudio()
  }, [])

  return null
}
