interface Props {
  score: number | string
  size?: 'sm' | 'md' | 'lg'
}

function scoreColor(score: number): string {
  if (score >= 4) return 'var(--success)'
  if (score >= 3) return 'var(--warning)'
  return 'var(--danger)'
}

export default function ScoreBadge({ score, size = 'md' }: Props) {
  const num = typeof score === 'string' ? parseFloat(score) : score
  const isNA = isNaN(num)
  const color = isNA ? 'var(--muted)' : scoreColor(num)

  return (
    <span
      className={`score-badge score-badge-${size}`}
      style={{ borderColor: color, color, background: isNA ? 'transparent' : `${color}18` }}
    >
      {isNA ? 'N/A' : `${score}/5`}
    </span>
  )
}

export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="score-bar">
      {[1, 2, 3, 4, 5].map(i => {
        const filled = i <= score
        const cls = filled
          ? score >= 4 ? 'filled' : score >= 3 ? 'warn' : 'danger'
          : ''
        return <div key={i} className={`score-bar-pip${cls ? ` ${cls}` : ''}`} />
      })}
    </div>
  )
}
