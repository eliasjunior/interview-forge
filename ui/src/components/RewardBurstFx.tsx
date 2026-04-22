import './RewardBurstFx.css'
import FloatingPoints from './FloatingPoints'

type RewardBurstFxProps = {
  animationKey: number
  points: number | null
  tone: 'strong' | 'decent' | 'weak' | null
  position: { top: number; left: number } | null
}

export default function RewardBurstFx({
  animationKey,
  points,
  tone,
  position,
}: RewardBurstFxProps) {
  if (points == null || tone == null || position == null) return null

  return (
    <div className={`crisis-reward-burst crisis-reward-burst--${tone}`} aria-hidden="true">
      <div
        key={`flash-${animationKey}`}
        className="crisis-reward-burst__flash"
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
      />
      <div
        key={`ring-${animationKey}`}
        className="crisis-reward-burst__ring"
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
      />
      <FloatingPoints points={points} tone={tone} position={position} />
    </div>
  )
}
