import { useEffect, useState } from 'react'
import type { PendingFlashcardAnswerItem } from '../api'
import { getPendingFlashcardAnswers } from '../api'

function formatDate(value?: string): string {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleString()
}

function compactText(value: string, limit = 160): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit - 1)}…`
}

export default function PendingFlashcardAnswersPage() {
  const [items, setItems] = useState<PendingFlashcardAnswerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void getPendingFlashcardAnswers()
      .then((response) => {
        if (cancelled) return
        setItems(response.items)
      })
      .catch((err) => {
        if (cancelled) return
        setError(String(err))
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="page-loading">Loading pending flashcard answers…</div>
  if (error) return <div className="error-msg">Failed to load pending flashcard answers: {error}</div>

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Pending Flashcard Evaluations</h1>
        <p className="page-subtitle">
          Answers captured in the flashcard UI and still waiting for the `evaluate_flashcard` tool.
        </p>
      </header>

      <section className="card">
        <div className="mistakes-header" style={{ marginBottom: 20 }}>
          <span className="mistakes-count">{items.length} pending</span>
        </div>

        {items.length === 0 ? (
          <div className="mistakes-empty">
            No pending flashcard answers right now. New learner answers will appear here in `Pending` state.
          </div>
        ) : (
          <div className="progress-table-wrap">
            <table className="progress-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Question</th>
                  <th>Candidate Answer</th>
                  <th>SM-2</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="progress-topic-cell">
                        <strong>{item.flashcard?.topic ?? 'Unknown topic'}</strong>
                        <span>{item.flashcard?.difficulty ?? 'unknown'} difficulty</span>
                      </div>
                    </td>
                    <td>{compactText(item.flashcard?.front ?? `Missing flashcard ${item.flashcardId}`)}</td>
                    <td>{compactText(item.content, 220)}</td>
                    <td>{item.smRating ?? '—'}</td>
                    <td>{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
