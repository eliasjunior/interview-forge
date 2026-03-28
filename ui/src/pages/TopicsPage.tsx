import { useEffect, useState } from 'react'
import type { Topic, TopicLevel } from '../api'

import { getTopics, getTopicLevel } from '../api'

// ── Level config ──────────────────────────────────────────────────────────────

// color = single source of truth used for dot, border, and left-border
const LEVEL_CONFIG: Record<0 | 1 | 2 | 3 | 4, {
  color: string
  bg: string
  text: string
  label: string
  desc: string
  semantic: string
}> = {
  0: { color: '#cbd5e1', bg: '#1f293760', text: '#e5e7eb', label: 'L0', desc: 'Spark', semantic: 'First exposure and recognition' },
  1: { color: '#7dd3fc', bg: '#082f4960', text: '#dbeafe', label: 'L1', desc: 'Padawan', semantic: 'Assisted recall with guidance' },
  2: { color: '#3b82f6', bg: '#0d1a3a60', text: '#bfdbfe', label: 'L2', desc: 'Forge', semantic: 'Shaping structured answers' },
  3: { color: '#f97316', bg: '#31130460', text: '#fdba74', label: 'L3', desc: 'Ranger', semantic: 'Capable in full mock interviews' },
  4: { color: '#c084fc', bg: '#3b076460', text: '#f3e8ff', label: 'L4', desc: 'Jedi Ready', semantic: 'Sustained real-interview readiness' },
}

function getLevelAppearance(level: keyof typeof LEVEL_CONFIG) {
  const cfg = LEVEL_CONFIG[level]
  return {
    color: cfg.color,
    badgeStyle: { background: cfg.bg, border: `1px solid ${cfg.color}`, color: cfg.text },
    cardBorderStyle: { borderLeft: `3px solid ${cfg.color}` },
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Dot({ color }: { color: string }) {
  return <span style={{ color, fontSize: '0.65rem', lineHeight: 1 }}>●</span>
}

function LevelBadge({ level }: { level: 0 | 1 | 2 | 3 | 4 }) {
  const cfg = LEVEL_CONFIG[level]
  const appearance = getLevelAppearance(level)
  return (
    <span
      className="topic-level-badge"
      style={appearance.badgeStyle}
    >
      <Dot color={appearance.color} /> {cfg.label} — {cfg.desc}
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

  const sortedTopics = [...topics].sort((a, b) => {
    const levelA = levels[a.file]?.level ?? Number.POSITIVE_INFINITY
    const levelB = levels[b.file]?.level ?? Number.POSITIVE_INFINITY
    if (levelA !== levelB) return levelA - levelB
    return a.displayName.localeCompare(b.displayName)
  })

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
        {([0, 1, 2, 3, 4] as const).map(lvl => {
          const cfg = LEVEL_CONFIG[lvl]
          const appearance = getLevelAppearance(lvl)
          return (
            <div key={lvl} className="legend-item">
              <div className="legend-badge" style={appearance.badgeStyle}>
                <Dot color={appearance.color} />
                <span className="legend-label">{cfg.label}</span>
                <span className="legend-desc">{cfg.desc}</span>
              </div>
              <span className="legend-semantic">{cfg.semantic}</span>
            </div>
          )
        })}
      </div>

      <div className="topics-list">
        {sortedTopics.map(topic => {
          const levelData = levels[topic.file]
          const level = levelData?.level
          const appearance = level !== undefined ? getLevelAppearance(level) : null

          return (
            <div
              key={topic.file}
              className="topic-card"
              style={appearance ? appearance.cardBorderStyle : { borderLeft: '3px solid var(--line)' }}
            >
              <div className="topic-card-main">
                <div className="topic-name">{topic.displayName}</div>
                <code className="topic-file">{topic.file}</code>
              </div>

              <div className="topic-card-right">
                {level !== undefined && levelData ? <LevelBadge level={level} /> : <LevelSkeleton />}
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
