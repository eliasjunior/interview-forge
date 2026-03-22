import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getGraph } from '../api'
import type { KnowledgeGraph, GraphNode, GraphEdge } from '@mock-interview/shared'

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
    </div>
  )
}
