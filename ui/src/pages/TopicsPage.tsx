import { useEffect, useState } from 'react'
import type { Topic } from '../api'
import { getTopics } from '../api'

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTopics().then(data => {
      setTopics(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <div className="topics-page">
      <div className="topics-header">
        <h1 className="topics-title">Interview Topics</h1>
        <span className="topics-count">{topics.length} topics</span>
      </div>

      <div className="topics-list">
        {topics.map(topic => (
          <div key={topic.file} className="topic-card">
            <div className="topic-name">{topic.displayName}</div>
            <code className="topic-file">{topic.file}</code>
          </div>
        ))}
      </div>

      {topics.length === 0 && (
        <div className="topics-empty">No knowledge files found.</div>
      )}
    </div>
  )
}
