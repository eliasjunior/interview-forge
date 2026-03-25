import { useEffect, useState } from 'react'
import type { Mistake } from '@mock-interview/shared'
import { getMistakes } from '../api'

export default function MistakesPage() {
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTopic, setActiveTopic] = useState<string | null>(null)

  useEffect(() => {
    getMistakes().then(data => {
      setMistakes(data)
      setLoading(false)
    })
  }, [])

  const topics = Array.from(new Set(mistakes.map(m => m.topic).filter(Boolean) as string[]))

  const filtered = activeTopic
    ? mistakes.filter(m => m.topic === activeTopic)
    : mistakes

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <div className="mistakes-page">
      <div className="mistakes-header">
        <h1 className="mistakes-title">Mistake Log</h1>
        <span className="mistakes-count">{mistakes.length} total</span>
      </div>

      {topics.length > 1 && (
        <div className="mistakes-filters">
          <button
            className={`mistakes-filter${activeTopic === null ? ' active' : ''}`}
            onClick={() => setActiveTopic(null)}
            type="button"
          >
            All
          </button>
          {topics.map(t => (
            <button
              key={t}
              className={`mistakes-filter${activeTopic === t ? ' active' : ''}`}
              onClick={() => setActiveTopic(t)}
              type="button"
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mistakes-empty">No mistakes logged yet. Run a drill and use <code>log_mistake</code> to capture learnings.</div>
      ) : (
        <div className="mistakes-list">
          {filtered.map(m => (
            <div
              key={m.id}
              className={`mistake-card${expanded === m.id ? ' expanded' : ''}`}
              onClick={() => setExpanded(expanded === m.id ? null : m.id)}
            >
              <div className="mistake-card-header">
                <div className="mistake-card-left">
                  {m.topic && <span className="mistake-topic-badge">{m.topic}</span>}
                  <span className="mistake-text">{m.mistake}</span>
                </div>
                <span className="mistake-date">
                  {new Date(m.createdAt).toLocaleDateString()}
                </span>
              </div>

              {expanded === m.id && (
                <div className="mistake-card-body">
                  <div className="mistake-section">
                    <span className="mistake-label">Pattern</span>
                    <p className="mistake-value">{m.pattern}</p>
                  </div>
                  <div className="mistake-section">
                    <span className="mistake-label">Fix</span>
                    <p className="mistake-value">{m.fix}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
