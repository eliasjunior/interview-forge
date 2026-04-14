import { useEffect, useRef, useState } from 'react'

type FailureFlashFxProps = {
  armed: boolean
  secondsRemaining: number | null
}

const FAILURE_FLASH_DURATION_MS = 900

export default function FailureFlashFx({
  armed,
  secondsRemaining,
}: FailureFlashFxProps) {
  const previousSecondsRef = useRef<number | null>(secondsRemaining)
  const [flashKey, setFlashKey] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const previousSeconds = previousSecondsRef.current
    previousSecondsRef.current = secondsRemaining

    if (!armed) return
    if (secondsRemaining !== 0 || previousSeconds === 0 || previousSeconds == null || previousSeconds <= 0) return

    setFlashKey((current) => current + 1)
    setVisible(true)
  }, [armed, secondsRemaining])

  useEffect(() => {
    if (!visible) return
    const timeoutId = window.setTimeout(() => setVisible(false), FAILURE_FLASH_DURATION_MS)
    return () => window.clearTimeout(timeoutId)
  }, [visible, flashKey])

  if (!visible) return null

  return (
    <div key={flashKey} className="failure-flash-fx" aria-hidden="true">
      <div className="failure-flash-wash" />
      <div className="failure-flash-ring" />
      <div className="failure-flash-copy">Time window missed</div>
    </div>
  )
}
