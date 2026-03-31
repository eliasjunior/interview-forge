import { useEffect, useState, useCallback } from 'react'
import type { Flashcard, ReviewRating } from '@mock-interview/shared'
import { dismissFlashcard, getFlashcards, reviewFlashcard } from '../api'

// ── Rating config ────────────────────────────────────────────────────────────

const RATINGS: { rating: ReviewRating; label: string; desc: string; cls: string }[] = [
  { rating: 1, label: 'Again', desc: 'Forgot',   cls: 'fc-btn-again' },
  { rating: 2, label: 'Hard',  desc: 'Difficult', cls: 'fc-btn-hard'  },
  { rating: 3, label: 'Good',  desc: 'Normal',    cls: 'fc-btn-good'  },
  { rating: 4, label: 'Easy',  desc: 'Perfect',   cls: 'fc-btn-easy'  },
]

// ── Markdown renderer ────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineFmt(text: string): string {
  return text
    .replace(/`([^`]+)`/g,      '<code class="fc-inline-code">$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/❌/g, '<span style="color:var(--danger)">❌</span>')
    .replace(/✅/g, '<span style="color:var(--success)">✅</span>')
}

function renderTable(lines: string[]): string {
  const rows = lines
    .filter(l => !/^\|[\s\-:|]+\|$/.test(l.trim()))
    .map(l => {
      const cells = l.split('|').slice(1, -1).map(c => c.trim())
      return `<tr>${cells.map(c => `<td>${inlineFmt(c)}</td>`).join('')}</tr>`
    })
  return `<table class="fc-table"><tbody>${rows.join('')}</tbody></table>`
}

function mdToHtml(text: string): string {
  const blocks: string[] = []

  // 1. Extract code fences first
  let s = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    const i = blocks.length
    blocks.push(`<pre class="fc-pre"><code>${escHtml(code.trimEnd())}</code></pre>`)
    return `\x00BLOCK${i}\x00`
  })

  const lines = s.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block placeholder
    if (/\x00BLOCK\d+\x00/.test(line)) {
      out.push(line.replace(/\x00BLOCK(\d+)\x00/g, (_, n) => blocks[+n]))
      i++; continue
    }

    // H2
    if (line.startsWith('## ')) {
      out.push(`<h3 class="fc-h3">${inlineFmt(line.slice(3))}</h3>`)
      i++; continue
    }

    // Table
    if (line.trimStart().startsWith('|')) {
      const tblLines: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        tblLines.push(lines[i]); i++
      }
      out.push(renderTable(tblLines)); continue
    }

    // Unordered list
    if (/^- /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(`<li>${inlineFmt(lines[i].slice(2))}</li>`); i++
      }
      out.push(`<ul class="fc-list">${items.join('')}</ul>`); continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      out.push(`<blockquote class="fc-blockquote">${inlineFmt(line.slice(2))}</blockquote>`)
      i++; continue
    }

    // Empty line
    if (!line.trim()) { out.push('<br/>'); i++; continue }

    out.push(`<p class="fc-p">${inlineFmt(line)}</p>`)
    i++
  }

  return out.join('')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isDue(card: Flashcard): boolean {
  return new Date(card.dueDate) <= new Date()
}

function formatDue(card: Flashcard): string {
  const ms = new Date(card.dueDate).getTime() - Date.now()
  if (ms <= 0) return 'Due now'
  const days = Math.ceil(ms / 86_400_000)
  return `Due in ${days}d`
}

function diffColor(d: string) {
  if (d === 'hard')   return 'var(--danger)'
  if (d === 'medium') return 'var(--warning)'
  return 'var(--success)'
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FlashcardsPage() {
  const [cards, setCards]           = useState<Flashcard[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [topicFilter, setTopicFilter] = useState('All')
  const [viewMode, setViewMode]     = useState<'active' | 'archived'>('active')

  // Review mode state
  const [reviewing, setReviewing]   = useState(false)
  const [queue, setQueue]           = useState<Flashcard[]>([])
  const [cursor, setCursor]         = useState(0)
  const [flipped, setFlipped]       = useState(false)
  const [rating, setRating]         = useState<ReviewRating | null>(null)
  const [done, setDone]             = useState(false)
  const [busyCardId, setBusyCardId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getFlashcards(true)
      .then(setCards)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="loading">Loading flashcards…</div>
  if (error)   return <div className="error-msg">Failed to load flashcards: {error}</div>

  const activeCards = cards.filter(c => !c.archivedAt)
  const archivedCards = cards.filter(c => c.archivedAt)
  const visibleCards = viewMode === 'active' ? activeCards : archivedCards
  const topics = ['All', ...Array.from(new Set(visibleCards.map(c => c.topic))).sort()]
  const filtered = topicFilter === 'All' ? visibleCards : visibleCards.filter(c => c.topic === topicFilter)
  const dueCards = filtered.filter(isDue)

  // ── Start review ────────────────────────────────────────────────────────────

  const startReview = () => {
    setQueue([...dueCards])
    setCursor(0)
    setFlipped(false)
    setRating(null)
    setDone(false)
    setReviewing(true)
  }

  const exitReview = () => {
    setReviewing(false)
    setDone(false)
    load()
  }

  const removeCardEverywhere = (cardId: string) => {
    setCards(prev => prev.map(card => (
      card.id === cardId ? { ...card, archivedAt: new Date().toISOString() } : card
    )))
    setQueue(prev => prev.filter(card => card.id !== cardId))
  }

  const handleDismiss = async (cardId: string) => {
    if (busyCardId) return
    setBusyCardId(cardId)
    try {
      await dismissFlashcard(cardId)
      removeCardEverywhere(cardId)
    } catch (e) {
      console.error('dismiss error', e)
      setError(String(e))
    } finally {
      setBusyCardId(null)
    }
  }

  // ── Review: rate card ────────────────────────────────────────────────────────

  const handleRate = async (r: ReviewRating) => {
    if (rating !== null) return // already rated, waiting for animation
    setRating(r)
    try {
      await reviewFlashcard(queue[cursor].id, r)
    } catch (e) {
      console.error('review error', e)
    }
    setTimeout(() => {
      const next = cursor + 1
      if (next >= queue.length) {
        setDone(true)
        load()
      } else {
        setCursor(next)
        setFlipped(false)
        setRating(null)
      }
    }, 400)
  }

  useEffect(() => {
    if (!reviewing) return
    if (queue.length === 0) {
      setDone(true)
      return
    }
    if (cursor >= queue.length) {
      setCursor(Math.max(0, queue.length - 1))
    }
  }, [reviewing, queue, cursor])

  // ── Review: all done ─────────────────────────────────────────────────────────

  if (reviewing && done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
        <h2 style={{ color: 'var(--accent)', marginBottom: 8 }}>All done!</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 28 }}>
          You reviewed {queue.length} card{queue.length !== 1 ? 's' : ''}. Check back tomorrow.
        </p>
        <button className="fc-start-btn" onClick={exitReview}>Back to cards</button>
      </div>
    )
  }

  // ── Review: flip card ─────────────────────────────────────────────────────────

  if (reviewing && queue.length > 0) {
    const card = queue[cursor]

    return (
      <div>
        {/* Header */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 className="page-title">Review</h1>
              <p className="page-subtitle">{card.topic} · card {cursor + 1} of {queue.length}</p>
            </div>
            <div className="fc-review-actions">
              <button
                className="fc-dismiss-btn"
                onClick={() => handleDismiss(card.id)}
                disabled={busyCardId === card.id || rating !== null}
              >
                {busyCardId === card.id ? 'Dismissing…' : 'Dismiss'}
              </button>
              <button className="btn-back" onClick={exitReview}>✕ Exit</button>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ marginTop: 12, height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(cursor / queue.length) * 100}%`,
              background: 'var(--accent)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Flip card */}
        <div
          className="fc-flip-wrapper"
          onClick={() => !flipped && setFlipped(true)}
          style={{ cursor: flipped ? 'default' : 'pointer' }}
        >
          <div className={`fc-flip-inner${flipped ? ' flipped' : ''}`}>

            {/* Front */}
            <div className="fc-face fc-front">
              <div className="fc-face-badge">
                <span style={{ borderColor: diffColor(card.difficulty), color: diffColor(card.difficulty) }}
                  className="tag">{card.difficulty}</span>
              </div>
              <div className="fc-face-label">Question</div>
              <div className="fc-question-text">{card.front}</div>
              <div className="fc-tap-hint">↩ click to reveal answer</div>
            </div>

            {/* Back */}
            <div className="fc-face fc-back">
              <div className="fc-face-label">Answer</div>
              <div
                className="fc-answer-text"
                dangerouslySetInnerHTML={{ __html: mdToHtml(card.back) }}
              />
            </div>

          </div>
        </div>

        {/* Rating row */}
        <div className={`fc-rating-row${flipped ? ' visible' : ''}`}>
          <p className="fc-rating-prompt">How well did you remember?</p>
          <div className="fc-rating-btns">
            {RATINGS.map(({ rating: r, label, desc, cls }) => (
              <button
                key={r}
                className={`fc-rating-btn ${cls}${rating === r ? ' selected' : ''}`}
                onClick={() => handleRate(r)}
                disabled={rating !== null}
              >
                <span className="fc-rating-label">{label}</span>
                <span className="fc-rating-desc">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Show answer hint */}
        {!flipped && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="fc-show-btn" onClick={() => setFlipped(true)}>
              Show Answer
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Overview ─────────────────────────────────────────────────────────────────

  const totalDue = activeCards.filter(isDue).length

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Flashcards</h1>
            <p className="page-subtitle">{activeCards.length} active · {archivedCards.length} archived · {totalDue} due today</p>
          </div>
          {viewMode === 'active' && dueCards.length > 0 && (
            <button className="fc-start-btn" onClick={startReview}>
              Start Review ({dueCards.length})
            </button>
          )}
        </div>
      </div>

      <div className="fc-view-switch">
        <button
          className={`tab-btn${viewMode === 'active' ? ' active' : ''}`}
          onClick={() => {
            setViewMode('active')
            setTopicFilter('All')
          }}
        >
          Active
        </button>
        <button
          className={`tab-btn${viewMode === 'archived' ? ' active' : ''}`}
          onClick={() => {
            setViewMode('archived')
            setTopicFilter('All')
          }}
        >
          Archived
        </button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{viewMode === 'active' ? activeCards.length : archivedCards.length}</div>
          <div className="stat-label">{viewMode === 'active' ? 'Active' : 'Archived'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: viewMode === 'active' && totalDue > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {viewMode === 'active' ? totalDue : archivedCards.length}
          </div>
          <div className="stat-label">{viewMode === 'active' ? 'Due Today' : 'Stored'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{topics.length - 1}</div>
          <div className="stat-label">Topics</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{visibleCards.filter(c => c.repetitions > 0).length}</div>
          <div className="stat-label">Reviewed</div>
        </div>
      </div>

      {/* Topic filter */}
      {topics.length > 2 && (
        <div className="tabs">
          {topics.map(t => (
            <button
              key={t}
              className={`tab-btn${topicFilter === t ? ' active' : ''}`}
              onClick={() => setTopicFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Card list */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🃏</div>
          <div className="empty-state-msg">
            {viewMode === 'active'
              ? 'No flashcards yet. Complete an interview — cards are generated automatically for any question scored below 4.'
              : 'No archived flashcards yet. Dismissed cards will appear here.'}
          </div>
        </div>
      ) : (
        <div className="fc-overview-grid">
          {/* Due cards first */}
          {viewMode === 'active' && dueCards.length > 0 && (
            <>
              <h2 className="fc-section-label">Due now · {dueCards.length}</h2>
              {dueCards.map(card => (
                <FlashcardRow
                  key={card.id}
                  card={card}
                  isDue
                  onDismiss={handleDismiss}
                  dismissing={busyCardId === card.id}
                />
              ))}
            </>
          )}
          {/* Upcoming cards */}
          {viewMode === 'active' && filtered.filter(c => !isDue(c)).length > 0 && (
            <>
              <h2 className="fc-section-label" style={{ marginTop: 24 }}>Upcoming</h2>
              {filtered.filter(c => !isDue(c)).map(card => (
                <FlashcardRow
                  key={card.id}
                  card={card}
                  isDue={false}
                  onDismiss={handleDismiss}
                  dismissing={busyCardId === card.id}
                />
              ))}
            </>
          )}
          {viewMode === 'archived' && (
            <>
              <h2 className="fc-section-label">Archived · {filtered.length}</h2>
              {filtered
                .slice()
                .sort((a, b) => new Date(b.archivedAt ?? 0).getTime() - new Date(a.archivedAt ?? 0).getTime())
                .map(card => (
                  <FlashcardRow
                    key={card.id}
                    card={card}
                    isDue={false}
                    onDismiss={handleDismiss}
                    dismissing={busyCardId === card.id}
                    archived
                  />
                ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── FlashcardRow ─────────────────────────────────────────────────────────────

function FlashcardRow(
  { card, isDue: due, onDismiss, dismissing, archived = false }:
  { card: Flashcard; isDue: boolean; onDismiss: (cardId: string) => void; dismissing: boolean; archived?: boolean }
) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`fc-row card card-hover${due ? ' fc-row-due' : ''}`}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="fc-row-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fc-row-topic">{card.topic}</div>
          <div className="fc-row-question">{card.front}</div>
        </div>
        <div className="fc-row-meta">
          {!archived && (
            <button
              className="fc-dismiss-btn fc-dismiss-inline"
              onClick={(e) => {
                e.stopPropagation()
                onDismiss(card.id)
              }}
              disabled={dismissing}
            >
              {dismissing ? 'Dismissing…' : 'Dismiss'}
            </button>
          )}
          {archived && (
            <span className="fc-archived-badge">Archived</span>
          )}
          <span className="tag" style={{ borderColor: diffColor(card.difficulty), color: diffColor(card.difficulty) }}>
            {card.difficulty}
          </span>
          <span style={{ fontSize: '0.75rem', color: due ? 'var(--warning)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
            {formatDue(card)}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            ×{card.repetitions}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', marginLeft: 4 }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {expanded && (
        <div
          className="fc-row-back"
          dangerouslySetInnerHTML={{ __html: mdToHtml(card.back) }}
          onClick={e => e.stopPropagation()}
        />
      )}
    </div>
  )
}
