import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getGraph } from '../api'
import type { KnowledgeGraph, GraphNode, GraphEdge } from '../types'

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

// ── D3 simulation types ────────────────────────────────────────────────────
interface SimNode extends d3.SimulationNodeDatum, GraphNode {}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number
}

export default function GraphPage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGraph()
      .then(setGraph)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!graph || !svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const rect = svgRef.current.getBoundingClientRect()
    const W = rect.width || 800
    const H = rect.height || 600

    if (graph.nodes.length === 0) return

    // Clone nodes/edges for simulation mutation
    const nodes: SimNode[] = graph.nodes.map(n => ({ ...n }))
    const nodeById = new Map(nodes.map(n => [n.id, n]))

    const links: SimLink[] = (graph.edges as GraphEdge[])
      .filter(e => nodeById.has(e.source as string) && nodeById.has(e.target as string))
      .map(e => ({
        source: nodeById.get(e.source as string)!,
        target: nodeById.get(e.target as string)!,
        weight: e.weight,
      }))

    // ── Zoom ────────────────────────────────────────────────────────────────
    const root = svg.append('g')
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', e => root.attr('transform', e.transform))
    )

    // ── Simulation ──────────────────────────────────────────────────────────
    const sim = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links)
        .id(d => d.id)
        .distance(d => Math.max(60, 120 / (d.weight + 1)))
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(22))

    // ── Edges ────────────────────────────────────────────────────────────────
    const maxWeight = Math.max(...links.map(l => l.weight), 1)
    const linkSel = root.append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#2a3957')
      .attr('stroke-opacity', 0.7)
      .attr('stroke-width', d => 0.5 + (d.weight / maxWeight) * 2.5)

    // ── Nodes ────────────────────────────────────────────────────────────────
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
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4)

    nodeSel.append('text')
      .text(d => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => 10 + d.clusters.length * 2.5)
      .attr('fill', '#e5ecf7')
      .attr('font-size', '10px')
      .attr('font-family', '"Avenir Next", "Segoe UI", sans-serif')
      .attr('pointer-events', 'none')

    // ── Tooltip ──────────────────────────────────────────────────────────────
    const tooltip = d3.select(tooltipRef.current)

    nodeSel
      .on('mouseenter', (event, d) => {
        tooltip
          .style('display', 'block')
          .html(`<strong>${d.label}</strong><br/>${d.clusters.join(', ')}`)
      })
      .on('mousemove', (event) => {
        const containerRect = svgRef.current!.parentElement!.getBoundingClientRect()
        tooltip
          .style('left', `${event.clientX - containerRect.left + 12}px`)
          .style('top', `${event.clientY - containerRect.top - 10}px`)
      })
      .on('mouseleave', () => tooltip.style('display', 'none'))

    // ── Tick ─────────────────────────────────────────────────────────────────
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Knowledge Graph</h1>
        <p className="page-subtitle">
          {graph
            ? `${graph.nodes.length} concepts · ${graph.edges.length} connections · ${graph.sessions.length} sessions`
            : 'Concepts extracted from all completed interview sessions'}
        </p>
      </div>

      {loading && <div className="loading">Loading graph…</div>}
      {error && <div className="error-msg">Failed to load graph: {error}</div>}

      {!loading && !error && graph?.nodes.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🕸️</div>
          <div className="empty-state-msg">No graph data yet. Complete an interview session to populate the graph.</div>
        </div>
      )}

      {!loading && !error && graph && graph.nodes.length > 0 && (
        <div className="graph-container">
          <svg ref={svgRef} className="graph-svg" />
          <div ref={tooltipRef} className="graph-tooltip" style={{ display: 'none' }} />
          <div className="graph-legend">
            {CLUSTER_LABELS.map(c => (
              <div key={c} className="legend-item">
                <div className="legend-dot" style={{ background: CLUSTER_COLOR[c] }} />
                {c}
              </div>
            ))}
            <div className="legend-item" style={{ marginTop: 4, borderTop: '1px solid var(--line)', paddingTop: 8, fontSize: '0.75rem' }}>
              Node size = cluster count
            </div>
            <div className="legend-item" style={{ fontSize: '0.75rem' }}>
              Edge width = co-occurrence weight
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
