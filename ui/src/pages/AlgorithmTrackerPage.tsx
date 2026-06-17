import { useEffect, useMemo, useState } from 'react'
import type { AlgorithmProblemDifficulty, AlgorithmProblemTrackerItem } from '@mock-interview/shared'
import {
  createAlgorithmProblem,
  deleteAlgorithmProblem,
  getAlgorithmProblems,
  updateAlgorithmProblem,
  type AlgorithmProblemInput,
} from '../api'

const difficulties: AlgorithmProblemDifficulty[] = ['Easy', 'Medium', 'Hard']

type LastReviewedSort = 'desc' | 'asc'

const emptyDraft: AlgorithmProblemInput = {
  problem: '',
  problemDescription: '',
  pattern: '',
  difficulty: 'Medium',
  trickyPart: '',
  mentalModel: '',
  commonMistake: '',
  complexity: '',
  reSolvedWithoutHelp: false,
  dateLastReviewed: new Date().toISOString().slice(0, 10),
  nextReviewDays: 1,
}

type EditableRow = AlgorithmProblemInput & { id: string }

type PatternGroup = {
  pattern: string
  items: AlgorithmProblemTrackerItem[]
  reviewedCount: number
}

function toEditableRow(item: AlgorithmProblemTrackerItem): EditableRow {
  return {
    id: item.id,
    problem: item.problem,
    problemDescription: item.problemDescription,
    pattern: item.pattern,
    difficulty: item.difficulty,
    trickyPart: item.trickyPart,
    mentalModel: item.mentalModel,
    commonMistake: item.commonMistake,
    complexity: item.complexity,
    reSolvedWithoutHelp: item.reSolvedWithoutHelp,
    dateLastReviewed: item.dateLastReviewed ?? '',
    nextReviewDays: item.nextReviewDays,
  }
}

export default function AlgorithmTrackerPage() {
  const [items, setItems] = useState<AlgorithmProblemTrackerItem[]>([])
  const [draft, setDraft] = useState<AlgorithmProblemInput>(emptyDraft)
  const [editing, setEditing] = useState<Record<string, EditableRow>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastReviewedSort, setLastReviewedSort] = useState<LastReviewedSort>('desc')
  const [collapsedPatterns, setCollapsedPatterns] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getAlgorithmProblems()
      .then(data => {
        if (!cancelled) setItems(data)
      })
      .catch(err => {
        if (!cancelled) setError(String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const summary = useMemo(() => {
    const solved = items.filter(item => item.reSolvedWithoutHelp).length
    const due = items.filter(item => isDue(item)).length
    const patterns = new Set(items.map(item => item.pattern).filter(Boolean))
    return { solved, due, patterns: patterns.size }
  }, [items])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const reviewedA = dateSortValue(a.dateLastReviewed)
      const reviewedB = dateSortValue(b.dateLastReviewed)
      if (reviewedA !== reviewedB) {
        if (reviewedA === null) return 1
        if (reviewedB === null) return -1
        return lastReviewedSort === 'desc'
          ? reviewedB - reviewedA
          : reviewedA - reviewedB
      }

      return a.problem.localeCompare(b.problem)
    })
  }, [items, lastReviewedSort])

  const patternGroups = useMemo(() => {
    const groups = new Map<string, AlgorithmProblemTrackerItem[]>()
    for (const item of sortedItems) {
      const pattern = item.pattern.trim() || 'Uncategorized'
      const current = groups.get(pattern) ?? []
      current.push(item)
      groups.set(pattern, current)
    }

    return Array.from(groups.entries())
      .map(([pattern, groupItems]) => ({
        pattern,
        items: groupItems,
        reviewedCount: groupItems.filter(item => Boolean(item.dateLastReviewed)).length,
      } satisfies PatternGroup))
      .sort((a, b) => a.pattern.localeCompare(b.pattern))
  }, [sortedItems])

  async function addProblem() {
    if (!draft.problem.trim()) {
      setError('Problem is required.')
      return
    }

    setSavingId('new')
    setError(null)
    try {
      const created = await createAlgorithmProblem({
        ...draft,
        problem: draft.problem.trim(),
        nextReviewDays: Number(draft.nextReviewDays) || 0,
      })
      setItems(current => [created, ...current])
      setDraft({ ...emptyDraft, dateLastReviewed: new Date().toISOString().slice(0, 10) })
    } catch (err) {
      setError(String(err))
    } finally {
      setSavingId(null)
    }
  }

  async function saveRow(id: string) {
    const row = editing[id]
    if (!row || !row.problem.trim()) {
      setError('Problem is required.')
      return
    }

    setSavingId(id)
    setError(null)
    try {
      const { id: _id, ...body } = row
      const updated = await updateAlgorithmProblem(id, {
        ...body,
        problem: body.problem.trim(),
        nextReviewDays: Number(body.nextReviewDays) || 0,
      })
      setItems(current => current.map(item => item.id === id ? updated : item))
      setEditing(current => {
        const next = { ...current }
        delete next[id]
        return next
      })
    } catch (err) {
      setError(String(err))
    } finally {
      setSavingId(null)
    }
  }

  async function removeRow(id: string) {
    setSavingId(id)
    setError(null)
    try {
      await deleteAlgorithmProblem(id)
      setItems(current => current.filter(item => item.id !== id))
      setEditing(current => {
        const next = { ...current }
        delete next[id]
        return next
      })
    } catch (err) {
      setError(String(err))
    } finally {
      setSavingId(null)
    }
  }

  if (loading) return <div className="page-loading">Loading algorithm tracker...</div>

  return (
    <div className="algorithm-page">
      <div className="page-header algorithm-header">
        <div>
          <h1 className="page-title">Algorithm Tracker</h1>
          <p className="page-subtitle">Track recognition patterns, friction points, mistakes, and recall timing after each problem.</p>
        </div>
        <div className="algorithm-summary">
          <span>{items.length} problems</span>
          <span>{summary.solved} re-solved</span>
          <span>{summary.due} due</span>
          <span>{summary.patterns} patterns</span>
        </div>
      </div>

      {error && <div className="error-msg algorithm-error">{error}</div>}

      <section className="algorithm-entry" aria-label="Add algorithm problem">
        <TrackerFields value={draft} onChange={setDraft} />
        <button className="btn-secondary algorithm-add-btn" type="button" onClick={addProblem} disabled={savingId === 'new'}>
          {savingId === 'new' ? 'Adding...' : '+ Add problem'}
        </button>
      </section>

      {items.length === 0 ? (
        <div className="algorithm-empty">No algorithm problems tracked yet. Add the next problem after a coding interview or exercise session.</div>
      ) : (
        <div className="algorithm-table-wrap">
          <table className="algorithm-table">
            <thead>
              <tr>
                <th>Problem</th>
                <th>Description</th>
                <th>Pattern</th>
                <th>Difficulty</th>
                <th>Tricky Part</th>
                <th>Mental Model</th>
                <th>Common Mistake</th>
                <th>Complexity</th>
                <th>Re-solved</th>
                <th>
                  <button
                    className="algorithm-sort-btn"
                    type="button"
                    onClick={() => setLastReviewedSort(current => current === 'desc' ? 'asc' : 'desc')}
                    aria-label={`Sort last reviewed ${lastReviewedSort === 'desc' ? 'oldest first' : 'latest first'}`}
                  >
                    Last Reviewed
                    <span aria-hidden="true">{lastReviewedSort === 'desc' ? '↓' : '↑'}</span>
                  </button>
                </th>
                <th>Next Review</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {patternGroups.map(group => (
                <PatternGroupRows
                  key={group.pattern}
                  group={group}
                  collapsed={Boolean(collapsedPatterns[group.pattern])}
                  editing={editing}
                  savingId={savingId}
                  onToggle={() => togglePattern(group.pattern)}
                  onEdit={startEditing}
                  onCancel={cancelEditing}
                  onSave={saveRow}
                  onDelete={removeRow}
                  onUpdateEditing={updateEditing}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  function startEditing(item: AlgorithmProblemTrackerItem) {
    setEditing(current => ({ ...current, [item.id]: toEditableRow(item) }))
  }

  function cancelEditing(id: string) {
    setEditing(current => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  function updateEditing(id: string, patch: Partial<EditableRow>) {
    setEditing(current => {
      const existing = current[id]
      if (!existing) return current
      return { ...current, [id]: { ...existing, ...patch } }
    })
  }

  function togglePattern(pattern: string) {
    setCollapsedPatterns(current => ({ ...current, [pattern]: !current[pattern] }))
  }
}

function PatternGroupRows({
  group,
  collapsed,
  editing,
  savingId,
  onToggle,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onUpdateEditing,
}: {
  group: PatternGroup
  collapsed: boolean
  editing: Record<string, EditableRow>
  savingId: string | null
  onToggle: () => void
  onEdit: (item: AlgorithmProblemTrackerItem) => void
  onCancel: (id: string) => void
  onSave: (id: string) => void
  onDelete: (id: string) => void
  onUpdateEditing: (id: string, patch: Partial<EditableRow>) => void
}) {
  return (
    <>
      <tr className="algorithm-pattern-row">
        <td colSpan={12}>
          <button
            className="algorithm-pattern-toggle"
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
          >
            <span className="algorithm-pattern-caret" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
            <span className="algorithm-pattern-name">{group.pattern}</span>
            <span className="algorithm-pattern-meta">{group.items.length} problems</span>
            <span className="algorithm-pattern-meta">{group.reviewedCount} reviewed</span>
          </button>
        </td>
      </tr>
      {!collapsed && group.items.map(item => {
        const row = editing[item.id]
        const display = row ?? toEditableRow(item)
        const editingRow = Boolean(row)
        return (
          <tr key={item.id} className={isDue(item) ? 'algorithm-row-due' : undefined}>
            <td>{editingRow ? <TextInput value={display.problem} onChange={value => onUpdateEditing(item.id, { problem: value })} /> : item.problem}</td>
            <td>{editingRow ? <TextArea value={display.problemDescription} onChange={value => onUpdateEditing(item.id, { problemDescription: value })} /> : item.problemDescription || '-'}</td>
            <td>{editingRow ? <TextInput value={display.pattern} onChange={value => onUpdateEditing(item.id, { pattern: value })} /> : item.pattern || '-'}</td>
            <td>
              {editingRow ? (
                <select
                  className="algorithm-input algorithm-select"
                  value={display.difficulty}
                  onChange={event => onUpdateEditing(item.id, { difficulty: event.target.value as AlgorithmProblemDifficulty })}
                >
                  {difficulties.map(difficulty => <option key={difficulty}>{difficulty}</option>)}
                </select>
              ) : (
                <span className={`algorithm-difficulty difficulty-${item.difficulty.toLowerCase()}`}>{item.difficulty}</span>
              )}
            </td>
            <td>{editingRow ? <TextArea value={display.trickyPart} onChange={value => onUpdateEditing(item.id, { trickyPart: value })} /> : item.trickyPart || '-'}</td>
            <td>{editingRow ? <TextArea value={display.mentalModel} onChange={value => onUpdateEditing(item.id, { mentalModel: value })} /> : item.mentalModel || '-'}</td>
            <td>{editingRow ? <TextArea value={display.commonMistake} onChange={value => onUpdateEditing(item.id, { commonMistake: value })} /> : item.commonMistake || '-'}</td>
            <td>{editingRow ? <TextInput value={display.complexity} onChange={value => onUpdateEditing(item.id, { complexity: value })} /> : item.complexity || '-'}</td>
            <td>
              <input
                type="checkbox"
                checked={display.reSolvedWithoutHelp}
                disabled={!editingRow}
                onChange={event => onUpdateEditing(item.id, { reSolvedWithoutHelp: event.target.checked })}
              />
            </td>
            <td>
              {editingRow ? (
                <input
                  className="algorithm-input"
                  type="date"
                  value={display.dateLastReviewed ?? ''}
                  onChange={event => onUpdateEditing(item.id, { dateLastReviewed: event.target.value })}
                />
              ) : (
                formatDate(item.dateLastReviewed)
              )}
            </td>
            <td>
              {editingRow ? (
                <input
                  className="algorithm-input algorithm-number"
                  type="number"
                  min="0"
                  max="365"
                  value={display.nextReviewDays}
                  onChange={event => onUpdateEditing(item.id, { nextReviewDays: Number(event.target.value) })}
                />
              ) : (
                formatNextReview(item)
              )}
            </td>
            <td>
              <div className="algorithm-actions">
                {editingRow ? (
                  <>
                    <button className="btn-secondary" type="button" onClick={() => onSave(item.id)} disabled={savingId === item.id}>Save</button>
                    <button className="btn-secondary" type="button" onClick={() => onCancel(item.id)} disabled={savingId === item.id}>Cancel</button>
                  </>
                ) : (
                  <button className="btn-secondary" type="button" onClick={() => onEdit(item)}>Edit</button>
                )}
                <button className="btn-danger" type="button" onClick={() => onDelete(item.id)} disabled={savingId === item.id}>Delete</button>
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}

function TrackerFields({
  value,
  onChange,
}: {
  value: AlgorithmProblemInput
  onChange: (value: AlgorithmProblemInput) => void
}) {
  return (
    <div className="algorithm-entry-grid">
      <label>
        <span>Problem</span>
        <TextInput value={value.problem} onChange={problem => onChange({ ...value, problem })} />
      </label>
      <label>
        <span>Pattern</span>
        <TextInput value={value.pattern} onChange={pattern => onChange({ ...value, pattern })} />
      </label>
      <label className="algorithm-wide">
        <span>Description</span>
        <TextArea value={value.problemDescription} onChange={problemDescription => onChange({ ...value, problemDescription })} />
      </label>
      <label>
        <span>Difficulty</span>
        <select
          className="algorithm-input algorithm-select"
          value={value.difficulty}
          onChange={event => onChange({ ...value, difficulty: event.target.value as AlgorithmProblemDifficulty })}
        >
          {difficulties.map(difficulty => <option key={difficulty}>{difficulty}</option>)}
        </select>
      </label>
      <label>
        <span>Complexity</span>
        <TextInput value={value.complexity} onChange={complexity => onChange({ ...value, complexity })} />
      </label>
      <label>
        <span>Last Reviewed</span>
        <input
          className="algorithm-input"
          type="date"
          value={value.dateLastReviewed ?? ''}
          onChange={event => onChange({ ...value, dateLastReviewed: event.target.value })}
        />
      </label>
      <label>
        <span>Next Review Days</span>
        <input
          className="algorithm-input"
          type="number"
          min="0"
          max="365"
          value={value.nextReviewDays}
          onChange={event => onChange({ ...value, nextReviewDays: Number(event.target.value) })}
        />
      </label>
      <label className="algorithm-checkbox-label">
        <input
          type="checkbox"
          checked={value.reSolvedWithoutHelp}
          onChange={event => onChange({ ...value, reSolvedWithoutHelp: event.target.checked })}
        />
        <span>Re-solved without help</span>
      </label>
      <label className="algorithm-wide">
        <span>Tricky Part</span>
        <TextArea value={value.trickyPart} onChange={trickyPart => onChange({ ...value, trickyPart })} />
      </label>
      <label className="algorithm-wide">
        <span>Mental Model</span>
        <TextArea value={value.mentalModel} onChange={mentalModel => onChange({ ...value, mentalModel })} />
      </label>
      <label className="algorithm-wide">
        <span>Common Mistake</span>
        <TextArea value={value.commonMistake} onChange={commonMistake => onChange({ ...value, commonMistake })} />
      </label>
    </div>
  )
}

function TextInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input className="algorithm-input" value={value} onChange={event => onChange(event.target.value)} />
}

function TextArea({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <textarea className="algorithm-input algorithm-textarea" value={value} onChange={event => onChange(event.target.value)} />
}

function isDue(item: AlgorithmProblemTrackerItem): boolean {
  if (!item.dateLastReviewed) return false
  const dueAt = new Date(item.dateLastReviewed)
  dueAt.setDate(dueAt.getDate() + item.nextReviewDays)
  return dueAt.getTime() <= Date.now()
}

function formatDate(value?: string): string {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : '-'
}

function dateSortValue(value?: string): number | null {
  if (!value) return null
  const timestamp = new Date(`${value}T00:00:00`).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatNextReview(item: AlgorithmProblemTrackerItem): string {
  if (!item.dateLastReviewed) return `${item.nextReviewDays} days`
  const dueAt = new Date(`${item.dateLastReviewed}T00:00:00`)
  dueAt.setDate(dueAt.getDate() + item.nextReviewDays)
  return `${item.nextReviewDays} days (${dueAt.toLocaleDateString()})`
}
