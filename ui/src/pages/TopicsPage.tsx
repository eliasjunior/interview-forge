import { useEffect, useState } from 'react'
import type { Topic, TopicLevel } from '../api'

import { getTopics, getTopicLevel } from '../api'

// ── Level config ──────────────────────────────────────────────────────────────

// color = single source of truth used for dot, border, and left-border
const LEVEL_CONFIG: Record<0 | 1 | 2 | 3, {
  color: string
  bg: string
  text: string
  label: string
  desc: string
}> = {
  0: { color: '#f59e0b', bg: '#2a1a0060', text: '#fde68a', label: 'L0', desc: 'Recognition' },
  1: { color: '#eab308', bg: '#2a200060', text: '#fef08a', label: 'L1', desc: 'Assisted Recall' },
  2: { color: '#3b82f6', bg: '#0d1a3a60', text: '#bfdbfe', label: 'L2', desc: 'Guided Answer' },
  3: { color: '#22c55e', bg: '#0d2a1a60', text: '#bbf7d0', label: 'L3', desc: 'Interview Ready (earned)' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Dot({ color }: { color: string }) {
  return <span style={{ color, fontSize: '0.65rem', lineHeight: 1 }}>●</span>
}

function LevelBadge({ level, status }: { level: 0 | 1 | 2 | 3; status: TopicLevel['status'] }) {
  const cfg = LEVEL_CONFIG[level]
  if (status === 'cold') {
    return (
      <span
        className="topic-level-badge"
        style={{ background: 'var(--bg-soft)', border: '1px solid var(--line)', color: 'var(--muted)' }}
      >
        <Dot color="var(--muted)" /> {cfg.label} — Not Started
      </span>
    )
  }
  return (
    <span
      className="topic-level-badge"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}`, color: cfg.text }}
    >
      <Dot color={cfg.color} /> {cfg.label} — {cfg.desc}
    </span>
  )
}

function LevelSkeleton() {
  return <span className="topic-level-skeleton" />
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [levels, setLevels] = useState<Record<string, TopicLevel>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTopics().then(data => {
      setTopics(data)
      setLoading(false)
      // Load levels in parallel after topics are displayed
      data.forEach(t => {
        getTopicLevel(t.displayName)
          .then(lvl => setLevels(prev => ({ ...prev, [t.file]: lvl })))
          .catch(() => {/* silently skip if level fetch fails */})
      })
    })
  }, [])

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <div className="topics-page">
      <div className="topics-header">
        <div>
          <h1 className="topics-title">Interview Topics</h1>
          <p className="topics-subtitle">
            Each topic has a progressive warm-up ladder before the full interview.
          </p>
        </div>
        <span className="topics-count">{topics.length} topics</span>
      </div>

      <div className="topics-level-legend">
        {([0, 1, 2, 3] as const).map(lvl => {
          const cfg = LEVEL_CONFIG[lvl]
          return (
            <div key={lvl} className="legend-item">
              <Dot color={cfg.color} />
              <span className="legend-label">{cfg.label}</span>
              <span className="legend-desc">{cfg.desc}</span>
            </div>
          )
        })}
      </div>

      <div className="topics-list">
        {topics.map(topic => {
          const levelData = levels[topic.file]
          const level = levelData?.level
          const cfg = level !== undefined ? LEVEL_CONFIG[level] : null

          return (
            <div
              key={topic.file}
              className="topic-card"
              style={cfg && levelData?.status !== 'cold' ? { borderLeft: `3px solid ${cfg.color}` } : { borderLeft: '3px solid var(--line)' }}
            >
              <div className="topic-card-main">
                <div className="topic-name">{topic.displayName}</div>
                <code className="topic-file">{topic.file}</code>
              </div>

              <div className="topic-card-right">
                {level !== undefined && levelData ? <LevelBadge level={level} status={levelData.status} /> : <LevelSkeleton />}
                {levelData && level !== undefined && level < 3 && (
                  <div className="topic-next-step">
                    {levelData.nextLevelRequirement}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {topics.length === 0 && (
        <div className="topics-empty">No knowledge files found.</div>
      )}
    </div>
  )
}
