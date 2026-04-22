import { useEffect, useState, useCallback } from 'react'
import type { Flashcard, ReviewRating } from '@mock-interview/shared'
import { dismissFlashcard, getFlashcardHistory, getFlashcardsPage, restoreFlashcard, reviewFlashcardWithAnswer } from '../api'

// ── Rating config ────────────────────────────────────────────────────────────

const RATINGS: { rating: ReviewRating; label: string; desc: string; cls: string }[] = [
  { rating: 1, label: 'Again', desc: 'Forgot',   cls: 'fc-btn-again' },
  { rating: 2, label: 'Hard',  desc: 'Difficult', cls: 'fc-btn-hard'  },
  { rating: 3, label: 'Good',  desc: 'Normal',    cls: 'fc-btn-good'  },
  { rating: 4, label: 'Easy',  desc: 'Perfect',   cls: 'fc-btn-easy'  },
]

const PAGE_SIZE = 20

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

function expandInlineOptionSeries(text: string): string {
  return text
    .split('\n')
    .flatMap((line) => {
      const matches = Array.from(line.matchAll(/\b([A-Z])\)\s/g))
      if (matches.length < 2) return [line]

      const firstIndex = matches[0]?.index ?? -1
      if (firstIndex < 0) return [line]

      const prefix = line.slice(0, firstIndex).trimEnd()
      const options = line
        .slice(firstIndex)
        .split(/,\s+(?=[A-Z]\)\s)/)
        .map(option => option.trim())
        .filter(Boolean)

      return [
        prefix,
        ...options.map(option => `- ${option}`),
      ].filter(Boolean)
    })
    .join('\n')
}

function mdToHtml(text: string): string {
  const blocks: string[] = []
  const normalizedText = expandInlineOptionSeries(text)

  // 1. Extract code fences first
  let s = normalizedText.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
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

function formatTimestamp(value?: string): string {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleString()
}

function compactFlashcardFront(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FlashcardsPage() {
  const [cards, setCards]           = useState<Flashcard[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [topicFilter, setTopicFilter] = useState('All')
  const [topicQuery, setTopicQuery] = useState('')
  const [viewMode, setViewMode]     = useState<'active' | 'archived'>('active')

  // Review mode state
  const [reviewing, setReviewing]   = useState(false)
  const [queue, setQueue]           = useState<Flashcard[]>([])
  const [cursor, setCursor]         = useState(0)
  const [flipped, setFlipped]       = useState(false)
  const [rating, setRating]         = useState<ReviewRating | null>(null)
  const [done, setDone]             = useState(false)
  const [busyCardId, setBusyCardId] = useState<string | null>(null)
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({})
  const [historyCardId, setHistoryCardId] = useState<string | null>(null)
  const [historyCards, setHistoryCards] = useState<Flashcard[]>([])
  const [historyTopic, setHistoryTopic] = useState('')
  const [historyHasHistory, setHistoryHasHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const currentStatus = viewMode === 'active' ? 'active' : 'archived'

  const loadPage = useCallback(async (reset: boolean, cursor?: string) => {
    const setBusy = reset ? setLoading : setLoadingMore
    setBusy(true)
    setError(null)
    try {
      const response = await getFlashcardsPage({
        status: currentStatus,
        topic: topicFilter === 'All' ? undefined : topicFilter,
        limit: PAGE_SIZE,
        cursor,
      })
      setCards(prev => reset ? response.items : [...prev, ...response.items])
      setTotalCount(response.total)
      setNextCursor(response.nextCursor)
      setHasMore(response.hasMore)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }, [currentStatus, topicFilter])

  useEffect(() => {
    void loadPage(true)
  }, [loadPage])

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

  if (loading) return <div className="loading">Loading flashcards…</div>
  if (error)   return <div className="error-msg">Failed to load flashcards: {error}</div>

  const visibleCards = cards
  const dueCountByTopic = new Map<string, number>()
  for (const card of cards) {
    if (!isDue(card)) continue
    dueCountByTopic.set(card.topic, (dueCountByTopic.get(card.topic) ?? 0) + 1)
  }
  const topics = ['All', ...Array.from(new Set(visibleCards.map(c => c.topic))).sort()]
  const normalizedTopicQuery = topicQuery.trim().toLowerCase()
  const topicOptions = normalizedTopicQuery
    ? topics.filter(topic => topic.toLowerCase().includes(normalizedTopicQuery))
    : topics
  const selectedTopicVisible = topicOptions.includes(topicFilter)
  const effectiveTopicFilter = selectedTopicVisible ? topicFilter : 'All'
  const dueCards = visibleCards.filter(isDue)

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
    void loadPage(true)
  }

  const removeVisibleCard = (cardId: string) => {
    setCards(prev => prev.filter(card => card.id !== cardId))
    setQueue(prev => prev.filter(card => card.id !== cardId))
    setDraftAnswers(prev => {
      if (!(cardId in prev)) return prev
      const next = { ...prev }
      delete next[cardId]
      return next
    })
    setTotalCount(prev => Math.max(0, prev - 1))
  }

  const handleDismiss = async (cardId: string) => {
    if (busyCardId) return
    setBusyCardId(cardId)
    try {
      await dismissFlashcard(cardId)
      removeVisibleCard(cardId)
    } catch (e) {
      console.error('dismiss error', e)
      setError(String(e))
    } finally {
      setBusyCardId(null)
    }
  }

  const handleRestore = async (cardId: string) => {
    if (busyCardId) return
    setBusyCardId(cardId)
    try {
      await restoreFlashcard(cardId)
      removeVisibleCard(cardId)
    } catch (e) {
      console.error('restore error', e)
      setError(String(e))
    } finally {
      setBusyCardId(null)
    }
  }

  // ── Review: rate card ────────────────────────────────────────────────────────

  const handleRate = async (r: ReviewRating) => {
    if (rating !== null) return // already rated, waiting for animation
    setError(null)
    const cardId = queue[cursor].id
    const trimmedAnswer = (draftAnswers[cardId] ?? '').trim()
    if (!trimmedAnswer) {
      setError('Answer is required before you rate this flashcard.')
      return
    }
    setRating(r)
    try {
      await reviewFlashcardWithAnswer(cardId, r, trimmedAnswer)
    } catch (e) {
      console.error('review or answer submit error', e)
      setError(String(e))
      setRating(null)
      return
    }
    setTimeout(() => {
      setDraftAnswers(prev => {
        if (!(cardId in prev)) return prev
        const nextAnswers = { ...prev }
        delete nextAnswers[cardId]
        return nextAnswers
      })
      const next = cursor + 1
      if (next >= queue.length) {
        setDone(true)
        void loadPage(true)
      } else {
        setCursor(next)
        setFlipped(false)
        setRating(null)
      }
    }, 400)
  }

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
    const myAnswer = draftAnswers[card.id] ?? ''

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
        <div className="fc-flip-wrapper">
          <div className={`fc-face ${flipped ? 'fc-back' : 'fc-front'}`}>
            <div className="fc-face-label">{flipped ? 'Answer' : 'Question'}</div>
            {flipped ? (
              <>
                <div className="fc-question-review">
                  <div className="fc-question-review-label">Prompt</div>
                  <div className="fc-question-review-text">{card.front}</div>
                </div>
                <div className="fc-answer-editor">
                  <div className="fc-question-review-label">Your Answer</div>
                  <textarea
                    className="fc-answer-input"
                    placeholder="Edit your answer before rating…"
                    value={myAnswer}
                    onChange={e => setDraftAnswers(prev => ({ ...prev, [card.id]: e.target.value }))}
                    rows={5}
                  />
                </div>
                <div
                  className="fc-answer-text"
                  dangerouslySetInnerHTML={{ __html: mdToHtml(card.back) }}
                />
              </>
            ) : (
              <>
                <div className="fc-question-text">{card.front}</div>
                <textarea
                  className="fc-answer-input"
                  placeholder="Write your answer before revealing…"
                  value={myAnswer}
                  onChange={e => setDraftAnswers(prev => ({ ...prev, [card.id]: e.target.value }))}
                  rows={4}
                />
                <div className="fc-tap-hint">Answer is required. Use “Show Answer” when you want to flip the card.</div>
              </>
            )}
          </div>
        </div>

        {/* Rating row */}
        <div className={`fc-rating-row${flipped ? ' visible' : ''}`}>
          <p className="fc-rating-prompt">How well did you remember? Submit your written answer first by choosing a rating.</p>
          <div className="fc-rating-btns">
            {RATINGS.map(({ rating: r, label, desc, cls }) => (
              <button
                key={r}
                className={`fc-rating-btn ${cls}${rating === r ? ' selected' : ''}`}
                onClick={() => handleRate(r)}
                disabled={rating !== null || !myAnswer.trim()}
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

  const openHistory = async (card: Flashcard) => {
    setHistoryCardId(card.id)
    setHistoryTopic(card.topic)
    setHistoryCards([])
    setHistoryHasHistory(false)
    setHistoryError(null)
    setHistoryLoading(true)
    try {
      const response = await getFlashcardHistory(card.id)
      setHistoryCards(response.items)
      setHistoryHasHistory(response.hasHistory)
      setHistoryCardId(response.selectedId)
    } catch (e) {
      setHistoryError(String(e))
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Flashcards</h1>
            <p className="page-subtitle">
              {totalCount} {viewMode} flashcard{totalCount !== 1 ? 's' : ''} · {cards.length} loaded{viewMode === 'active' ? ` · ${dueCards.length} due in view` : ''}
            </p>
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
            setTopicQuery('')
          }}
        >
          Active
        </button>
        <button
          className={`tab-btn${viewMode === 'archived' ? ' active' : ''}`}
          onClick={() => {
            setViewMode('archived')
            setTopicFilter('All')
            setTopicQuery('')
          }}
        >
          Archived
        </button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{totalCount}</div>
          <div className="stat-label">{viewMode === 'active' ? 'Active' : 'Archived'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: viewMode === 'active' && dueCards.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {cards.length}
          </div>
          <div className="stat-label">Loaded</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{topics.length - 1}</div>
          <div className="stat-label">Topics</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{visibleCards.filter(c => c.repetitions > 0).length}</div>
          <div className="stat-label">Reviewed In View</div>
        </div>
      </div>

      {/* Topic filter */}
      {topics.length > 1 && (
        <div className="fc-topic-filter">
          <input
            className="fc-topic-search"
            type="text"
            value={topicQuery}
            onChange={(e) => setTopicQuery(e.target.value)}
            placeholder="Search topics"
          />
          <select
            className="fc-topic-select"
            value={effectiveTopicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
          >
            {!selectedTopicVisible && topicFilter !== 'All' && (
              <option value="All">All</option>
            )}
            {topicOptions.map(topic => (
              <option key={topic} value={topic}>
                {topic === 'All'
                  ? `All${cards.length > 0 ? ` (${cards.length})` : ''}`
                  : `${topic}${viewMode === 'active' && (dueCountByTopic.get(topic) ?? 0) > 0 ? ` (${dueCountByTopic.get(topic)})` : ''}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Card list */}
      {visibleCards.length === 0 ? (
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
                  onShowHistory={openHistory}
                  dismissing={busyCardId === card.id}
                />
              ))}
            </>
          )}
          {/* Upcoming cards */}
          {viewMode === 'active' && visibleCards.filter(c => !isDue(c)).length > 0 && (
            <>
              <h2 className="fc-section-label" style={{ marginTop: 24 }}>Upcoming</h2>
              {visibleCards.filter(c => !isDue(c)).map(card => (
                <FlashcardRow
                  key={card.id}
                  card={card}
                  isDue={false}
                  onDismiss={handleDismiss}
                  onShowHistory={openHistory}
                  dismissing={busyCardId === card.id}
                />
              ))}
            </>
          )}
          {viewMode === 'archived' && (
            <>
              <h2 className="fc-section-label">Archived · {visibleCards.length}</h2>
              {visibleCards.map(card => (
                  <FlashcardRow
                    key={card.id}
                    card={card}
                    isDue={false}
                    onDismiss={handleRestore}
                    onShowHistory={openHistory}
                    dismissing={busyCardId === card.id}
                    archived
                  />
                ))}
            </>
          )}
        </div>
      )}

      {hasMore && !reviewing && (
        <div className="fc-load-more">
          <button
            className="fc-start-btn"
            onClick={() => void loadPage(false, nextCursor ?? undefined)}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : `Load more (${Math.max(totalCount - cards.length, 0)} remaining)`}
          </button>
        </div>
      )}

      {historyCardId && (
        <div className="graph-modal-backdrop" onClick={() => setHistoryCardId(null)}>
          <div className="fc-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fc-history-header">
              <div className="fc-history-header-copy">
                <h3>Flashcard History</h3>
                <p className="fc-history-subtitle">{historyTopic}</p>
              </div>
              <button className="fc-history-close" onClick={() => setHistoryCardId(null)}>Close</button>
            </div>

            {historyLoading ? (
              <div className="fc-history-empty">
                <h4>Loading history…</h4>
              </div>
            ) : historyError ? (
              <div className="fc-history-empty">
                <h4>Could not load history</h4>
                <p>{historyError}</p>
              </div>
            ) : !historyHasHistory ? (
              <div className="fc-history-empty">
                <h4>No history yet</h4>
                <p>This flashcard has not been replaced or improved yet. When Claude creates a stronger version, it will appear here.</p>
              </div>
            ) : (
              <div className="fc-history-list">
                {historyCards.map((card, index) => {
                  const isSelected = card.id === historyCardId
                  const isCurrent = !card.archivedAt
                  return (
                    <div key={card.id} className={`fc-history-item${isSelected ? ' selected' : ''}`}>
                      <div className="fc-history-rail" aria-hidden="true">
                        <span className={`fc-history-dot${isCurrent ? ' current' : ''}`} />
                        {index < historyCards.length - 1 && <span className="fc-history-line" />}
                      </div>
                      <div className="fc-history-card">
                        <div className="fc-history-item-header">
                          <div className="fc-history-version">
                            {index === 0 ? 'Original' : `Improved v${index + 1}`}
                          </div>
                          <div className="fc-history-badges">
                            <span className={`tag${isSelected ? ' active' : ''}`}>{isSelected ? 'Viewing' : 'Version'}</span>
                            <span className="tag" style={{ borderColor: isCurrent ? 'var(--success)' : 'var(--line)', color: isCurrent ? 'var(--success)' : 'var(--muted)' }}>
                              {isCurrent ? 'Current' : 'Archived'}
                            </span>
                          </div>
                        </div>
                        <div className="fc-history-question">{card.front}</div>
                        <div className="fc-history-meta">
                          <span>Created {formatTimestamp(card.createdAt)}</span>
                          {card.archivedAt && <span>Archived {formatTimestamp(card.archivedAt)}</span>}
                        </div>
                        <div className="fc-history-preview">
                          {card.back.slice(0, 220)}{card.back.length > 220 ? '…' : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── FlashcardRow ─────────────────────────────────────────────────────────────

function FlashcardRow(
  { card, isDue: due, onDismiss, onShowHistory, dismissing, archived = false }:
  { card: Flashcard; isDue: boolean; onDismiss: (cardId: string) => void; onShowHistory: (card: Flashcard) => void; dismissing: boolean; archived?: boolean }
) {
  const [expanded, setExpanded] = useState(false)
  const hasHistory = Boolean(card.parentFlashcardId || card.replacedByFlashcardId)

  return (
    <div
      className={`fc-row card card-hover${due ? ' fc-row-due' : ''}`}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="fc-row-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fc-row-topic">{card.topic}</div>
          <div className="fc-row-question">{compactFlashcardFront(card.front)}</div>
        </div>
        <div className="fc-row-meta">
          {hasHistory && (
            <button
              className="fc-history-btn"
              onClick={(e) => {
                e.stopPropagation()
                onShowHistory(card)
              }}
            >
              History
            </button>
          )}
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
            <button
              className="fc-dismiss-btn fc-dismiss-inline"
              onClick={(e) => {
                e.stopPropagation()
                onDismiss(card.id)
              }}
              disabled={dismissing}
            >
              {dismissing ? 'Restoring…' : 'Put Back'}
            </button>
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
