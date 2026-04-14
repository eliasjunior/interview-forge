type FloatingPointsProps = {
  points: number | null
  tone: 'strong' | 'decent' | 'weak' | null
  position: { top: number; left: number } | null
}

export default function FloatingPoints({ points, tone, position }: FloatingPointsProps) {
  if (points == null || tone == null || position == null) return null

  return (
    <div
      className={`floating-points ${tone}`}
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      aria-hidden="true"
    >
      +{points} pts
    </div>
  )
}
