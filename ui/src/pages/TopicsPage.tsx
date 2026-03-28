import { useEffect, useState } from 'react'
import type { Topic, TopicLevel } from '../api'

import { getTopics, getTopicLevel } from '../api'

const LEVEL_STORAGE_KEY = 'topics-level-snapshot'

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

function ProgressPips({ current, required }: { current: number; required: number }) {
  return (
    <div className="topic-progress-pips" aria-hidden="true">
      {Array.from({ length: required }, (_, index) => (
        <span
          key={index}
          className={`topic-progress-pip ${index < current ? 'filled' : ''}`}
        />
      ))}
    </div>
  )
}

function getProgressTitle(levelData: TopicLevel) {
  if (levelData.progress.variant === 'complete') return 'Interview ready'
  return `Progress to L${levelData.progress.targetLevel}`
}

function getStoredLevels() {
  try {
    const raw = window.localStorage.getItem(LEVEL_STORAGE_KEY)
    if (!raw) return {} as Record<string, number>
    return JSON.parse(raw) as Record<string, number>
  } catch {
    return {} as Record<string, number>
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [levels, setLevels] = useState<Record<string, TopicLevel>>({})
  const [celebrating, setCelebrating] = useState<Record<string, true>>({})
  const [toastQueue, setToastQueue] = useState<Array<{ id: string; message: string; level: 0 | 1 | 2 | 3 | 4 }>>([])
  const [activeToast, setActiveToast] = useState<{ id: string; message: string; level: 0 | 1 | 2 | 3 | 4 } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedLevels = getStoredLevels()

    getTopics().then(data => {
      setTopics(data)
      setLoading(false)
      // Load levels in parallel after topics are displayed
      data.forEach(t => {
        getTopicLevel(t.displayName)
          .then(lvl => {
            setLevels(prev => ({ ...prev, [t.file]: lvl }))

            const previousLevel = storedLevels[t.file]
            if (typeof previousLevel === 'number' && lvl.level > previousLevel) {
              setCelebrating(prev => ({ ...prev, [t.file]: true }))
              setToastQueue(prev => [
                ...prev,
                {
                  id: `${t.file}-${lvl.level}`,
                  message: `${t.displayName} reached ${LEVEL_CONFIG[lvl.level].label}: ${LEVEL_CONFIG[lvl.level].desc}`,
                  level: lvl.level,
                },
              ])
              window.setTimeout(() => {
                setCelebrating(prev => {
                  const next = { ...prev }
                  delete next[t.file]
                  return next
                })
              }, 1800)
            }

            storedLevels[t.file] = lvl.level
            window.localStorage.setItem(LEVEL_STORAGE_KEY, JSON.stringify(storedLevels))
          })
          .catch(() => {/* silently skip if level fetch fails */})
      })
    })
  }, [])

  useEffect(() => {
    if (activeToast || toastQueue.length === 0) return
    const [nextToast, ...rest] = toastQueue
    setActiveToast(nextToast)
    setToastQueue(rest)
  }, [activeToast, toastQueue])

  useEffect(() => {
    if (!activeToast) return
    const timeoutId = window.setTimeout(() => setActiveToast(null), 3200)
    return () => window.clearTimeout(timeoutId)
  }, [activeToast])

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
              className={`topic-card ${celebrating[topic.file] ? 'topic-card-leveled-up' : ''}`}
              style={appearance ? appearance.cardBorderStyle : { borderLeft: '3px solid var(--line)' }}
            >
              <div className="topic-card-main">
                <div className="topic-name">{topic.displayName}</div>
                <code className="topic-file">{topic.file}</code>
              </div>

              <div className="topic-card-right">
                {level !== undefined && levelData ? <LevelBadge level={level} /> : <LevelSkeleton />}
                {levelData && level !== undefined && (
                  <div className="topic-progress">
                    <div className="topic-progress-header">
                      <span className="topic-progress-title">{getProgressTitle(levelData)}</span>
                      <span className="topic-progress-meta">{levelData.progress.label}</span>
                    </div>
                    <ProgressPips
                      current={Math.min(levelData.progress.current, levelData.progress.required)}
                      required={levelData.progress.required}
                    />
                    <div className="topic-next-step">
                      {levelData.nextLevelRequirement}
                    </div>
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

      {activeToast && (
        <div
          className="topic-level-toast"
          style={{ borderColor: LEVEL_CONFIG[activeToast.level].color, color: LEVEL_CONFIG[activeToast.level].text }}
        >
          {activeToast.message}
        </div>
      )}
    </div>
  )
}
