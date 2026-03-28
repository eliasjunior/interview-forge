import { useEffect, useRef, useState } from 'react'
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

function LadderRungs({ currentLevel }: { currentLevel: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <div className="topic-rungs" aria-label="Topic progression ladder">
      {([0, 1, 2, 3, 4] as const).map((lvl) => {
        const state = lvl < currentLevel ? 'done' : lvl === currentLevel ? 'current' : 'locked'
        return (
          <div key={lvl} className={`topic-rung topic-rung-${state}`}>
            <span className="topic-rung-mark">{lvl < currentLevel ? '✓' : lvl === currentLevel ? '•' : '○'}</span>
            <span className="topic-rung-label">{LEVEL_CONFIG[lvl].label}</span>
          </div>
        )
      })}
    </div>
  )
}

function getProgressTitle(levelData: TopicLevel) {
  if (levelData.progress.variant === 'complete') return 'Interview ready'
  return `Progress to L${levelData.progress.targetLevel}`
}

function getAlmostThereCopy(levelData: TopicLevel) {
  if (!levelData.progress.almostThere) return null
  if (levelData.progress.variant === 'interview') {
    return `One strong interview unlocks ${LEVEL_CONFIG[levelData.progress.targetLevel].label}.`
  }
  return `One more pass unlocks ${LEVEL_CONFIG[levelData.progress.targetLevel].label}.`
}

function getNoProgressCopy(levelData: TopicLevel) {
  if (levelData.progress.almostThere || levelData.progress.variant === 'complete') return null
  if (!levelData.progress.attempted) return null

  if (levelData.status === 'dropped') {
    return levelData.reason
  }

  if (levelData.progress.current === 0) {
    return levelData.reason
  }

  return null
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

type TopicAction = {
  key: string
  label: string
  prompt: string
  helper: string
}

function getRecommendedAction(levelData: TopicLevel, topicFile: string): TopicAction {
  if (levelData.status === 'dropped') {
    return {
      key: 'warmup-reset',
      label: 'Warm-up reinforcement',
      prompt: `Start a warm-up interview for "${topicFile}" at the recommended level.`,
      helper: 'Recover the ladder after a weak full interview.',
    }
  }

  if (levelData.level >= 3 || levelData.progress.variant === 'interview') {
    return {
      key: 'full',
      label: 'Full interview',
      prompt: `Start a mock interview for "${topicFile}".`,
      helper: 'Push the topic forward with a full round.',
    }
  }

  return {
    key: 'warmup',
    label: 'Warm-up',
    prompt: `Start a warm-up interview for "${topicFile}".`,
    helper: 'Best next move for the current ladder state.',
  }
}

function getTopicActions(levelData: TopicLevel, topicFile: string): TopicAction[] {
  const recommended = getRecommendedAction(levelData, topicFile)
  const actions: TopicAction[] = [
    recommended,
    {
      key: 'drill',
      label: 'Drill weak spots',
      prompt: `Drill me on weak spots for "${topicFile}".`,
      helper: 'Good after at least one completed interview.',
    },
    {
      key: 'flashcards',
      label: 'Review flashcards',
      prompt: `Review my due flashcards for "${topicFile}".`,
      helper: 'Quick recall round for weak answers.',
    },
    {
      key: 'copy',
      label: 'Copy topic prompt',
      prompt: `Start a mock interview for "${topicFile}".`,
      helper: 'Plain prompt for the current topic slug.',
    },
  ]

  return actions.filter((action, index, arr) => arr.findIndex((candidate) => candidate.key === action.key) === index)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [levels, setLevels] = useState<Record<string, TopicLevel>>({})
  const [celebrating, setCelebrating] = useState<Record<string, true>>({})
  const [toastQueue, setToastQueue] = useState<Array<{ id: string; message: string; level: 0 | 1 | 2 | 3 | 4 }>>([])
  const [activeToast, setActiveToast] = useState<{ id: string; message: string; level: 0 | 1 | 2 | 3 | 4 } | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const refreshInFlightRef = useRef(false)

  useEffect(() => {
    const storedLevels = getStoredLevels()

    async function refreshTopics(showLoading = false) {
      if (refreshInFlightRef.current) return
      refreshInFlightRef.current = true
      if (showLoading) setLoading(true)

      try {
        const data = await getTopics()
        setTopics(data)

        const entries = await Promise.all(
          data.map(async (t) => {
            try {
              const lvl = await getTopicLevel(t.displayName)
              return [t.file, lvl, t.displayName] as const
            } catch {
              return null
            }
          })
        )

        const nextLevels: Record<string, TopicLevel> = {}
        entries.forEach((entry) => {
          if (!entry) return
          const [file, lvl, displayName] = entry
          nextLevels[file] = lvl

          const previousLevel = storedLevels[file]
          if (typeof previousLevel === 'number' && lvl.level > previousLevel) {
            setCelebrating(prev => ({ ...prev, [file]: true }))
            setToastQueue(prev => [
              ...prev,
              {
                id: `${file}-${lvl.level}`,
                message: `${displayName} reached ${LEVEL_CONFIG[lvl.level].label}: ${LEVEL_CONFIG[lvl.level].desc}`,
                level: lvl.level,
              },
            ])
            window.setTimeout(() => {
              setCelebrating(prev => {
                const next = { ...prev }
                delete next[file]
                return next
              })
            }, 1800)
          }

          storedLevels[file] = lvl.level
        })

        setLevels(nextLevels)
        window.localStorage.setItem(LEVEL_STORAGE_KEY, JSON.stringify(storedLevels))
      } finally {
        setLoading(false)
        refreshInFlightRef.current = false
      }
    }

    refreshTopics(true)

    function handleFocus() {
      refreshTopics(false)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshTopics(false)
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
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

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!pageRef.current?.contains(event.target as Node)) {
        setActiveMenu(null)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [])

  async function handleCopyPrompt(topicFile: string, action: TopicAction) {
    try {
      await navigator.clipboard.writeText(action.prompt)
      setToastQueue(prev => [
        ...prev,
        {
          id: `${topicFile}-${action.key}-copied`,
          message: `Copied: ${action.label}`,
          level: 1,
        },
      ])
      setActiveMenu(null)
    } catch {
      setToastQueue(prev => [
        ...prev,
        {
          id: `${topicFile}-${action.key}-failed`,
          message: `Could not copy the prompt for ${action.label}.`,
          level: 0,
        },
      ])
    }
  }

  if (loading) return <div className="page-loading">Loading...</div>

  const sortedTopics = [...topics].sort((a, b) => {
    const levelA = levels[a.file]?.level ?? Number.POSITIVE_INFINITY
    const levelB = levels[b.file]?.level ?? Number.POSITIVE_INFINITY
    if (levelA !== levelB) return levelA - levelB
    return a.displayName.localeCompare(b.displayName)
  })

  return (
    <div className="topics-page" ref={pageRef}>
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
          const actions = levelData ? getTopicActions(levelData, topic.file) : []

          return (
            <div
              key={topic.file}
              className={`topic-card ${celebrating[topic.file] ? 'topic-card-leveled-up' : ''}`}
              style={appearance ? appearance.cardBorderStyle : { borderLeft: '3px solid var(--line)' }}
            >
              <div className="topic-card-main">
                <div className="topic-name">{topic.displayName}</div>
                <div className="topic-file-row">
                  <button
                    className="topic-file-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setActiveMenu(prev => (prev === topic.file ? null : topic.file))
                    }}
                  >
                    New Round
                  </button>
                  {levelData && activeMenu === topic.file && (
                    <div className="topic-action-menu topic-action-menu-left" onClick={(event) => event.stopPropagation()}>
                      <div className="topic-action-menu-title">Suggested commands</div>
                      <code className="topic-action-topic">{topic.file}</code>
                      {actions.map((action, index) => (
                        <button
                          key={action.key}
                          className={`topic-action-item ${index === 0 ? 'recommended' : ''}`}
                          onClick={() => handleCopyPrompt(topic.file, action)}
                        >
                          <div className="topic-action-row">
                            <span className="topic-action-label">{action.label}</span>
                            {index === 0 && <span className="topic-action-badge">Recommended</span>}
                          </div>
                          <div className="topic-action-helper">{action.helper}</div>
                          <code className="topic-action-prompt">{action.prompt}</code>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="topic-card-right">
                {level !== undefined && levelData ? <LevelBadge level={level} /> : <LevelSkeleton />}
                {levelData && level !== undefined && (
                  <div className="topic-progress">
                    <LadderRungs currentLevel={level} />
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
                    {getAlmostThereCopy(levelData) && (
                      <div className="topic-almost-there">
                        {getAlmostThereCopy(levelData)}
                      </div>
                    )}
                    {getNoProgressCopy(levelData) && (
                      <div className="topic-why-stalled">
                        {getNoProgressCopy(levelData)}
                      </div>
                    )}
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
