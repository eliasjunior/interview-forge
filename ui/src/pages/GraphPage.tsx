import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getGraph, inspectGraphNodes } from '../api'
import type { KnowledgeGraph, GraphNode, GraphEdge, GraphInspectionResult } from '@mock-interview/shared'

// ── Cluster colours ────────────────────────────────────────────────────────
const CLUSTER_COLOR: Record<string, string> = {
  'core concepts':   '#4fd1c5',
  'practical usage': '#818cf8',
  'tradeoffs':       '#fb923c',
  'best practices':  '#86efac',
}

const CLUSTER_LABELS = Object.keys(CLUSTER_COLOR)

function nodeColor(node: GraphNode): string {
  for (const c of CLUSTER_LABELS) {
    if (node.clusters.includes(c)) return CLUSTER_COLOR[c]
  }
  return '#9db0d0'
}

function clusterAnchor(cluster: string, width: number, height: number) {
  const anchors: Record<string, { x: number; y: number }> = {
    'core concepts':   { x: width * 0.34, y: height * 0.34 },
    'practical usage': { x: width * 0.66, y: height * 0.34 },
    'tradeoffs':       { x: width * 0.34, y: height * 0.66 },
    'best practices':  { x: width * 0.66, y: height * 0.66 },
  }
  return anchors[cluster] ?? { x: width * 0.5, y: height * 0.5 }
}

function averageClusterAnchor(node: GraphNode, width: number, height: number) {
  if (node.clusters.length === 0) return { x: width * 0.5, y: height * 0.5 }

  const anchors = node.clusters.map(cluster => clusterAnchor(cluster, width, height))
  const x = anchors.reduce((sum, anchor) => sum + anchor.x, 0) / anchors.length
  const y = anchors.reduce((sum, anchor) => sum + anchor.y, 0) / anchors.length
  return { x, y }
}

// ── D3 simulation types ────────────────────────────────────────────────────
interface SimNode extends d3.SimulationNodeDatum, GraphNode {}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number
  kind: GraphEdge['kind']
  relation: string
}

export default function GraphPage() {
  const svgRef     = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Store D3 selections in refs so we can update them without re-running the sim
  const nodeSelRef = useRef<d3.Selection<SVGGElement, SimNode, SVGGElement, unknown> | null>(null)
  const linkSelRef = useRef<d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown> | null>(null)

  const [graph, setGraph]             = useState<KnowledgeGraph | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [inspection, setInspection] = useState<GraphInspectionResult | null>(null)
  const [inspectionLoading, setInspectionLoading] = useState(false)
  const [inspectionError, setInspectionError] = useState<string | null>(null)

  const selectedNodeById = useMemo(
    () => new Map((inspection?.selectedNodes ?? []).map(node => [node.id, node])),
    [inspection]
  )
  const semanticEdges = useMemo(
    () => inspection?.directEdges.filter(edge => edge.kind === 'semantic') ?? [],
    [inspection]
  )
  const strongCooccurrenceEdges = useMemo(
    () => inspection?.directEdges.filter(edge => edge.kind === 'cooccurrence' && edge.weight > 1) ?? [],
    [inspection]
  )
  const lowSignalCooccurrenceCount = useMemo(
    () => inspection?.directEdges.filter(edge => edge.kind === 'cooccurrence' && edge.weight <= 1).length ?? 0,
    [inspection]
  )

  useEffect(() => {
    getGraph()
      .then(setGraph)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  // ── Build / rebuild simulation whenever graph data changes ─────────────
  useEffect(() => {
    if (!graph || !svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    nodeSelRef.current = null
    linkSelRef.current = null

    const rect = svgRef.current.getBoundingClientRect()
    const W = rect.width  || 1200
    const H = rect.height || 700

    if (graph.nodes.length === 0) return

    const nodes: SimNode[] = graph.nodes.map(n => ({ ...n }))
    const nodeById = new Map(nodes.map(n => [n.id, n]))

    const links: SimLink[] = (graph.edges as GraphEdge[])
      .filter(e => nodeById.has(e.source as string) && nodeById.has(e.target as string))
      .map(e => ({
        source: nodeById.get(e.source as string)!,
        target: nodeById.get(e.target as string)!,
        weight: e.weight,
        kind: e.kind,
        relation: e.relation,
      }))

    // ── Zoom ──────────────────────────────────────────────────────────────
    const root = svg.append('g')
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.15, 5])
        .on('zoom', e => root.attr('transform', e.transform))
    )

    // ── Simulation ────────────────────────────────────────────────────────
    const sim = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links)
        .id(d => d.id)
        .distance(d => Math.max(70, 140 / (d.weight + 1)))
      )
      .force('charge', d3.forceManyBody().strength(-160))
      .force('cluster-x', d3.forceX<SimNode>(d => averageClusterAnchor(d, W, H).x).strength(0.06))
      .force('cluster-y', d3.forceY<SimNode>(d => averageClusterAnchor(d, W, H).y).strength(0.06))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(26))

    // ── Edges ─────────────────────────────────────────────────────────────
    const maxWeight = Math.max(...links.map(l => l.weight), 1)
    const linkSel = root.append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.kind === 'semantic' ? '#e7c66a' : '#2a3957')
      .attr('stroke-opacity', d => d.kind === 'semantic' ? 0.9 : 0.7)
      .attr('stroke-width', d => d.kind === 'semantic' ? 1.6 + (d.weight / maxWeight) * 1.4 : 0.5 + (d.weight / maxWeight) * 2.5)
      .attr('stroke-dasharray', d => d.kind === 'semantic' ? '6 4' : null)

    linkSelRef.current = linkSel as unknown as d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown>

    // ── Nodes ─────────────────────────────────────────────────────────────
    const nodeSel = root.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'grab')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) sim.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )

    nodeSel.append('circle')
      .attr('r', d => 7 + d.clusters.length * 2.5)
      .attr('fill', d => nodeColor(d))
      .attr('fill-opacity', 0.85)
      .attr('stroke', d => nodeColor(d))
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.4)

    nodeSel.append('text')
      .text(d => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => 13 + d.clusters.length * 2.5)
      .attr('fill', '#e5ecf7')
      .attr('fill-opacity', 1)
      .attr('font-size', '10px')
      .attr('font-family', '"Avenir Next", "Segoe UI", sans-serif')
      .attr('pointer-events', 'none')

    nodeSelRef.current = nodeSel as unknown as d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>

    // ── Tooltip ───────────────────────────────────────────────────────────
    const tooltip = d3.select(tooltipRef.current)

    nodeSel
      .on('mouseenter', (_, d) => {
        tooltip
          .style('display', 'block')
          .html(
            `<strong style="color:#e5ecf7">${d.label}</strong>` +
            `<div style="margin-top:4px;color:#9db0d0;font-size:0.78rem">${d.clusters.join(' · ')}</div>`
          )
      })
      .on('mousemove', (event) => {
        const containerRect = svgRef.current!.parentElement!.getBoundingClientRect()
        tooltip
          .style('left', `${event.clientX - containerRect.left + 14}px`)
          .style('top',  `${event.clientY - containerRect.top  - 12}px`)
      })
      .on('click', (_, d) => {
        setSelectedNodeIds(prev =>
          prev.includes(d.id)
            ? prev.filter(id => id !== d.id)
            : [...prev, d.id]
        )
      })
      .on('mouseleave', () => tooltip.style('display', 'none'))

    // ── Tick ──────────────────────────────────────────────────────────────
    sim.on('tick', () => {
      linkSel
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0)

      nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { sim.stop() }
  }, [graph])

  // ── Apply filter overlay whenever activeFilter changes ─────────────────
  useEffect(() => {
    const nodeSel = nodeSelRef.current
    const linkSel = linkSelRef.current
    if (!nodeSel || !linkSel) return

    if (activeFilter === null) {
      // Reset all
      nodeSel.select('circle')
        .attr('fill-opacity', 0.85)
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', 2)
      nodeSel.select('text')
        .attr('fill-opacity', 1)
      linkSel
        .attr('stroke-opacity', 0.7)
        .attr('stroke', '#2a3957')
    } else {
      nodeSel.select('circle')
        .attr('fill-opacity',   d => d.clusters.includes(activeFilter) ? 1   : 0.12)
        .attr('stroke-opacity', d => d.clusters.includes(activeFilter) ? 1   : 0.08)
        .attr('stroke-width',   d => d.clusters.includes(activeFilter) ? 2.5 : 1)
      nodeSel.select('text')
        .attr('fill-opacity', d => d.clusters.includes(activeFilter) ? 1 : 0.18)
      linkSel
        .attr('stroke-opacity', d => {
          const s = d.source as SimNode
          const t = d.target as SimNode
          const both = s.clusters.includes(activeFilter) && t.clusters.includes(activeFilter)
          if (!both) return d.kind === 'semantic' ? 0.12 : 0.07
          return d.kind === 'semantic' ? 0.95 : 0.75
        })
        .attr('stroke', d => {
          const s = d.source as SimNode
          const t = d.target as SimNode
          const both = s.clusters.includes(activeFilter) && t.clusters.includes(activeFilter)
          if (d.kind === 'semantic') {
            return both ? '#e7c66a' : '#5b4d24'
          }
          return both ? CLUSTER_COLOR[activeFilter] : '#2a3957'
        })
    }
  }, [activeFilter])

  // ── Apply selected-node highlight ──────────────────────────────────────
  useEffect(() => {
    const nodeSel = nodeSelRef.current
    if (!nodeSel) return

    const hasSelection = selectedNodeIds.length > 0

    nodeSel.select('circle')
      .attr('stroke', d => selectedNodeIds.includes(d.id) ? '#fff4b3' : nodeColor(d))
      .attr('stroke-width', d => selectedNodeIds.includes(d.id) ? 4 : 2)
      .attr('stroke-opacity', d => selectedNodeIds.includes(d.id) ? 1 : 0.4)
      .attr('fill-opacity', d => {
        if (!hasSelection) return d.clusters.includes(activeFilter ?? '') || activeFilter === null ? 0.85 : 0.12
        return selectedNodeIds.includes(d.id) ? 1 : 0.22
      })

    nodeSel.select('text')
      .attr('font-weight', d => selectedNodeIds.includes(d.id) ? 700 : 400)
      .attr('fill-opacity', d => {
        if (!hasSelection) return d.clusters.includes(activeFilter ?? '') || activeFilter === null ? 1 : 0.18
        return selectedNodeIds.includes(d.id) ? 1 : 0.32
      })
  }, [selectedNodeIds, activeFilter])

  const selectedNodes = graph
    ? graph.nodes.filter(node => selectedNodeIds.includes(node.id))
    : []

  async function openInspection() {
    if (selectedNodeIds.length === 0) return
    setInspectionLoading(true)
    setInspectionError(null)
    try {
      setInspection(await inspectGraphNodes(selectedNodeIds))
    } catch (e) {
      setInspectionError(String(e))
    } finally {
      setInspectionLoading(false)
    }
  }

  return (
    <div className="graph-page">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="graph-page-header">
        <div>
          <h1 className="page-title">Knowledge Graph</h1>
          <p className="page-subtitle">
            {graph
              ? `${graph.nodes.length} concepts · ${graph.edges.length} connections · ${graph.sessions.length} sessions`
              : 'Concepts extracted from all completed interview sessions'}
          </p>
        </div>

        {/* ── Cluster filter pills ─────────────────────────────────── */}
        {graph && graph.nodes.length > 0 && (
          <div className="graph-filter-row">
            <span className="graph-filter-label">Filter</span>
            {CLUSTER_LABELS.map(c => (
              <button
                key={c}
                className={`legend-filter-btn ${activeFilter === c ? 'active' : ''}`}
                style={{ '--cluster-color': CLUSTER_COLOR[c] } as React.CSSProperties}
                onClick={() => setActiveFilter(prev => prev === c ? null : c)}
              >
                <span className="legend-dot" style={{ background: CLUSTER_COLOR[c] }} />
                {c}
              </button>
            ))}
            {activeFilter && (
              <button className="legend-filter-clear" onClick={() => setActiveFilter(null)}>
                ✕ clear
              </button>
            )}
          </div>
        )}

        {selectedNodes.length > 0 && (
          <div className="graph-filter-row">
            <span className="graph-filter-label">Selected</span>
            {selectedNodes.map(node => (
              <button
                key={node.id}
                className="legend-filter-btn active"
                style={{ '--cluster-color': nodeColor(node) } as React.CSSProperties}
                onClick={() => setSelectedNodeIds(prev => prev.filter(id => id !== node.id))}
              >
                <span className="legend-dot" style={{ background: nodeColor(node) }} />
                {node.label}
              </button>
            ))}
            <button className="legend-filter-clear" onClick={() => setSelectedNodeIds([])}>
              ✕ clear selected
            </button>
            <button className="graph-action-btn" onClick={openInspection}>
              Inspect selected
            </button>
          </div>
        )}
      </div>

      {/* ── States ──────────────────────────────────────────────────── */}
      {loading && <div className="loading">Loading graph…</div>}
      {error   && <div className="error-msg">Failed to load graph: {error}</div>}

      {!loading && !error && graph?.nodes.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🕸️</div>
          <div className="empty-state-msg">No graph data yet. Complete an interview session to populate the graph.</div>
        </div>
      )}

      {/* ── Canvas ──────────────────────────────────────────────────── */}
      {!loading && !error && graph && graph.nodes.length > 0 && (
        <div className="graph-container">
          <svg ref={svgRef} className="graph-svg" />
          <div ref={tooltipRef} className="graph-tooltip" style={{ display: 'none' }} />

          {/* Mini legend bottom-right */}
          <div className="graph-legend">
            <div className="legend-hint">Node size = cluster count</div>
            <div className="legend-hint">Edge width = co-occurrence</div>
            <div className="legend-hint" style={{ marginTop: 4 }}>Scroll to zoom · Drag nodes</div>
          </div>
        </div>
      )}

      {(inspectionLoading || inspection || inspectionError) && (
        <div className="graph-modal-backdrop" onClick={() => {
          if (inspectionLoading) return
          setInspection(null)
          setInspectionError(null)
        }}>
          <div className="graph-modal" onClick={e => e.stopPropagation()}>
            <div className="graph-modal-header">
              <div>
                <h2 className="page-title">Selected Concept Evidence</h2>
                <p className="page-subtitle">
                  {selectedNodeIds.length} selected concepts
                </p>
              </div>
              <button
                className="legend-filter-clear"
                onClick={() => {
                  setInspection(null)
                  setInspectionError(null)
                }}
              >
                ✕ close
              </button>
            </div>

            {inspectionLoading && <div className="loading">Loading selected-node evidence…</div>}
            {inspectionError && <div className="error-msg">Failed to inspect selected nodes: {inspectionError}</div>}

            {!inspectionLoading && inspection && (
              <div className="graph-modal-body">
                <section className="graph-modal-section">
                  <div className="fc-section-label">Relationship Summary</div>
                  <div className="graph-chip-row">
                    {inspection.selectedNodes.map(node => (
                      <span key={node.id} className="legend-filter-btn active" style={{ '--cluster-color': nodeColor(node) } as React.CSSProperties}>
                        <span className="legend-dot" style={{ background: nodeColor(node) }} />
                        {node.label}
                      </span>
                    ))}
                  </div>

                  {inspection.directEdges.length > 0 ? (
                    <div className="graph-inspection-list">
                      {semanticEdges.map(edge => (
                        <RelationshipCard
                          key={`${edge.source}-${edge.target}-${edge.kind}-${edge.relation}`}
                          edge={edge}
                          sourceLabel={selectedNodeById.get(edge.source)?.label ?? edge.source}
                          targetLabel={selectedNodeById.get(edge.target)?.label ?? edge.target}
                        />
                      ))}
                      {strongCooccurrenceEdges.map(edge => (
                        <RelationshipCard
                          key={`${edge.source}-${edge.target}-${edge.kind}-${edge.relation}`}
                          edge={edge}
                          sourceLabel={selectedNodeById.get(edge.source)?.label ?? edge.source}
                          targetLabel={selectedNodeById.get(edge.target)?.label ?? edge.target}
                        />
                      ))}
                      {semanticEdges.length === 0 && strongCooccurrenceEdges.length === 0 && (
                        <div className="summary-box graph-inspection-card">
                          These concepts only show up together in one-off interview evidence, so the raw graph links are hidden here.
                        </div>
                      )}
                      {lowSignalCooccurrenceCount > 0 && (
                        <div className="legend-hint">
                          Hidden {lowSignalCooccurrenceCount} low-signal graph link{lowSignalCooccurrenceCount === 1 ? '' : 's'}.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="summary-box">No direct relationship is stored yet between these selected concepts.</div>
                  )}
                </section>

                <section className="graph-modal-section">
                  <div className="fc-section-label">Shared Interview Evidence</div>
                  {inspection.sessionsMatchingAll.length > 0 ? (
                    <div className="graph-inspection-list">
                      {inspection.sessionsMatchingAll.map(session => (
                        <div key={session.sessionId} className="summary-box graph-inspection-card">
                          <strong>{session.topic}</strong>
                          <div className="legend-hint">{new Date(session.createdAt).toLocaleString()}</div>
                          <div className="graph-chip-row">
                            {session.selectedConcepts.map(concept => (
                              <span key={concept.id} className="legend-filter-btn active" style={{ '--cluster-color': nodeColor(concept as GraphNode) } as React.CSSProperties}>
                                <span className="legend-dot" style={{ background: nodeColor(concept as GraphNode) }} />
                                {concept.label}
                              </span>
                            ))}
                          </div>
                          <div className="graph-inspection-question-list">
                            {session.questions.map(question => (
                              <InspectionQuestionCard
                                key={`${session.sessionId}-${question.questionIndex}`}
                                question={question}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="summary-box">No single completed interview session includes all of these concepts together yet.</div>
                  )}
                </section>

                <section className="graph-modal-section">
                  <div className="fc-section-label">Related Interview Evidence</div>
                  {inspection.sessionsMatchingAny.length > 0 ? (
                    <div className="graph-inspection-list">
                      {inspection.sessionsMatchingAny.map(session => (
                        <div key={session.sessionId} className="summary-box graph-inspection-card">
                          <strong>{session.topic}</strong>
                          <div className="legend-hint">{new Date(session.createdAt).toLocaleString()}</div>
                          <div className="graph-chip-row">
                            {session.selectedConcepts.map(concept => (
                              <span key={concept.id} className="legend-filter-btn active" style={{ '--cluster-color': nodeColor(concept as GraphNode) } as React.CSSProperties}>
                                <span className="legend-dot" style={{ background: nodeColor(concept as GraphNode) }} />
                                {concept.label}
                              </span>
                            ))}
                          </div>
                          <div className="graph-inspection-question-list">
                            {session.questions.map(question => (
                              <InspectionQuestionCard
                                key={`${session.sessionId}-${question.questionIndex}`}
                                question={question}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="summary-box">No additional related interview evidence was found beyond the shared sessions above.</div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RelationshipCard({
  edge,
  sourceLabel,
  targetLabel,
}: {
  edge: GraphEdge
  sourceLabel: string
  targetLabel: string
}) {
  if (edge.kind === 'semantic') {
    return (
      <div className="summary-box graph-inspection-card graph-relationship-card semantic">
        <div className="graph-relationship-title">
          <strong>{sourceLabel}</strong> {humanizeRelation(edge.relation)} <strong>{targetLabel}</strong>
        </div>
        <div className="legend-hint">Semantic relationship</div>
      </div>
    )
  }

  return (
    <div className="summary-box graph-inspection-card graph-relationship-card cooccurrence">
      <div className="graph-relationship-title">
        <strong>{sourceLabel}</strong> and <strong>{targetLabel}</strong> appeared together in {edge.weight} session{edge.weight === 1 ? '' : 's'}.
      </div>
      <div className="legend-hint">Repeated co-occurrence</div>
    </div>
  )
}

function humanizeRelation(relation: string): string {
  switch (relation) {
    case 'diagnoses':
      return 'helps diagnose'
    case 'inspects':
      return 'helps inspect'
    case 'applies-to':
      return 'applies to'
    default:
      return relation.replace(/-/g, ' ')
  }
}

function InspectionQuestionCard({
  question,
}: {
  question: GraphInspectionResult['sessionsMatchingAll'][number]['questions'][number]
}) {
  return (
    <div className="graph-inspection-question-card">
      <div className="graph-inspection-question-header">
        <div className="graph-inspection-question-title">
          <span className="graph-inspection-question-index">Q{question.questionIndex + 1}</span>
          <span>{question.question}</span>
        </div>
        {question.score != null && (
          <span className={`graph-inspection-score-badge score-${scoreTone(question.score)}`}>
            {question.score}/5
          </span>
        )}
      </div>

      {question.answer && (
        <div className="graph-inspection-answer">
          <div className="graph-inspection-label">Your answer</div>
          <div>{question.answer}</div>
        </div>
      )}

      {question.strongAnswer && (
        <div className="graph-inspection-strong-answer">
          <div className="graph-inspection-label">Stronger answer</div>
          <div>{question.strongAnswer}</div>
        </div>
      )}

      {!question.strongAnswer && question.score != null && question.score < 4 && (
        <div className="graph-inspection-missing-answer">
          No corrected answer was stored for this interview item.
        </div>
      )}
    </div>
  )
}

function scoreTone(score: number) {
  if (score <= 2) return 'weak'
  if (score === 3) return 'mid'
  return 'strong'
}
