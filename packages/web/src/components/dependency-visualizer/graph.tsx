import React, { useEffect, useRef, useCallback, useState } from 'react'
import * as d3 from 'd3'
import { DependencyGraph, D3Node, D3Link, EntityType } from '../types'
import { parseDependencyGraph } from '../utils/graphUtils'
import { ZoomIn, ZoomOut, Maximize, Box, NetworkIcon, Minimize } from 'lucide-react'
import { NODE_CONFIG } from '@/lib/constants'
import { AppType, NodeType } from '@/lib/server-types'

interface DependencyGraphVisualizerProps {
  data: DependencyGraph
  onNodeClick?: (node: D3Node) => void
  focusNodeId: string
}

// --- Visual Constants & Helpers ---

// Increased base radius to ensure Abbr text fits inside
const getNodeRadius = (node: D3Node) => {
  const baseRadius = 12
  const degree = node.degree || 0
  return baseRadius + Math.sqrt(degree) * 2.5
}

const getNodeColor = (type: EntityType) => {
  const config = NODE_CONFIG[type as NodeType | AppType] || NODE_CONFIG.Default
  return config.color
}

const getNodeAbbreviation = (type: EntityType) => {
  const config = NODE_CONFIG[type as NodeType | AppType] || NODE_CONFIG.Default
  return config.abbr
}

// 1.0 = Compact
// 2.0 = Normal
// 3.0+ = Very Spread Out (Good for large datasets)
const SCATTER_FACTOR = 3.0
// Colors
const COLOR_DEFAULT_LINK = '#cbd5e1' // slate-300
const COLOR_BIDIRECTIONAL = '#f59e0b' // amber-500 (Highlight Color)
const DependencyGraphVisualizer: React.FC<DependencyGraphVisualizerProps> = ({
  data,
  onNodeClick,
  focusNodeId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Refs
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null)
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)
  const nodesRef = useRef<D3Node[]>([])
  const quadtreeRef = useRef<d3.Quadtree<D3Node> | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !data) return

    // 1. Parse Data
    const { nodes, links } = parseDependencyGraph(data)
    nodesRef.current = nodes

    const nodeCount = nodes.length
    const isMassive = nodeCount > 500

    const canvas = canvasRef.current
    const context = canvas.getContext('2d', { alpha: false })
    const container = containerRef.current
    if (!context) return

    // 2. DPI Setup
    const width = container.clientWidth
    const height = container.clientHeight
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.scale(dpr, dpr)

    if (simulationRef.current) simulationRef.current.stop()

    // 3. Physics Simulation (SCATTER_FACTOR applied here)
    const simulation = d3
      .forceSimulation<D3Node, D3Link>(nodes)
      .alphaDecay(0.04)
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Link>(links)
          .id((d) => d.id)
          .distance((d) => {
            const s = d.source as D3Node
            const t = d.target as D3Node
            // Scale base distance by SCATTER_FACTOR
            const base = (isMassive ? 100 : 80) * SCATTER_FACTOR
            return base + getNodeRadius(s) + getNodeRadius(t)
          }),
      )
      .force(
        'charge',
        d3
          .forceManyBody()
          // Much stronger repulsion based on SCATTER_FACTOR
          .strength(-500 * SCATTER_FACTOR)
          .theta(0.9),
      )
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force(
        'collide',
        d3
          .forceCollide()
          // Larger collision buffer based on SCATTER_FACTOR to prevent overlap
          .radius((d: any) => getNodeRadius(d) * (1 + SCATTER_FACTOR * 0.3))
          .iterations(1),
      )

    simulationRef.current = simulation

    // --- NEW ARROW DRAWER (Mid-Line) ---
    const drawArrow = (
      ctx: CanvasRenderingContext2D,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      targetRadius: number,
      zoomScale: number,
      color: string,
      showArrowHead: boolean,
    ) => {
      const dx = x2 - x1
      const dy = y2 - y1
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Safety: Don't draw if nodes are basically touching
      if (dist < targetRadius + 20) return

      const ux = dx / dist
      const uy = dy / dist

      // 1. Draw the full Line (Source Center -> Target Edge)
      // We subtract targetRadius so the line stops clean at the node circle
      const stopX = x2 - ux * (targetRadius + 2)
      const stopY = y2 - uy * (targetRadius + 2)

      ctx.strokeStyle = color
      ctx.fillStyle = color

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(stopX, stopY)
      ctx.stroke()

      // 2. Draw Arrowhead (At ~62% of the distance)
      // Using 0.62 ensures that if A->B and B->A exist, the arrows
      // will be separated (one at 62%, the other at 38%)
      if (showArrowHead) {
        const ratio = 0.62
        const midX = x1 + dx * ratio
        const midY = y1 + dy * ratio

        const arrowLen = Math.max(6, 12 / Math.sqrt(zoomScale))
        const arrowWidth = arrowLen * 0.5

        ctx.beginPath()
        // Move to the tip of the arrow (at the mid-point)
        ctx.moveTo(midX, midY)
        // Draw back corners relative to the tip
        ctx.lineTo(midX - arrowLen * ux - arrowWidth * -uy, midY - arrowLen * uy - arrowWidth * ux)
        ctx.lineTo(midX - arrowLen * ux + arrowWidth * -uy, midY - arrowLen * uy + arrowWidth * ux)
        ctx.closePath()
        ctx.fill()
      }
    }

    const render = () => {
      const transform = transformRef.current
      context.save()
      context.fillStyle = '#f8fafc'
      context.fillRect(0, 0, width, height)

      context.translate(transform.x, transform.y)
      context.scale(transform.k, transform.k)

      const [minX, minY] = transform.invert([0, 0])
      const [maxX, maxY] = transform.invert([width, height])
      const padding = 200

      // LOD Thresholds
      const showText = transform.k > 0.45
      const showArrows = transform.k > 0.45
      const simplifyNodes = transform.k < 0.15

      // A. Draw Links & Arrows
      context.lineWidth = 1.5 / Math.sqrt(transform.k)

      links.forEach((link: any) => {
        const s = link.source as D3Node
        const t = link.target as D3Node
        if (s.x === undefined || s.y === undefined || t.x === undefined || t.y === undefined) return

        // Culling
        if (
          (s.x < minX - padding || s.x > maxX + padding) &&
          (t.x < minX - padding || t.x > maxX + padding)
        )
          return

        const linkColor = link.isBiDirectional ? COLOR_BIDIRECTIONAL : COLOR_DEFAULT_LINK

        // Clean call - no seed or staggering needed anymore!
        drawArrow(context, s.x, s.y, t.x, t.y, getNodeRadius(t), transform.k, linkColor, showArrows)
      })

      // B. Draw Nodes
      nodes.forEach((node) => {
        if (node.x === undefined || node.y === undefined) return
        if (
          node.x < minX - padding ||
          node.x > maxX + padding ||
          node.y < minY - padding ||
          node.y > maxY + padding
        )
          return

        const radius = getNodeRadius(node)

        if (simplifyNodes) {
          context.fillStyle = getNodeColor(node.type)
          context.fillRect(node.x - radius, node.y - radius, radius * 2, radius * 2)
          return
        }

        context.beginPath()
        context.fillStyle = getNodeColor(node.type)
        context.arc(node.x, node.y, radius, 0, 2 * Math.PI)
        context.fill()

        if (focusNodeId === node.id) {
          context.strokeStyle = '#2563eb'
          context.lineWidth = 4 / transform.k
          context.stroke()
        } else {
          context.strokeStyle = '#ffffff'
          context.lineWidth = 1.5 / transform.k
          context.stroke()
        }

        if (showText) {
          const abbr = getNodeAbbreviation(node.type)
          context.fillStyle = '#ffffff'
          const fontSize = Math.min(radius, 16)
          context.font = `700 ${fontSize}px sans-serif`
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          context.fillText(abbr, node.x, node.y + 1)
        }
      })

      // C. Draw Labels (Zoomed In Only)
      if (transform.k > 0.7) {
        context.textAlign = 'center'
        context.textBaseline = 'top'
        context.lineJoin = 'round'
        context.lineWidth = 3
        context.strokeStyle = 'rgba(255, 255, 255, 0.85)'
        context.fillStyle = '#334155'
        context.font = `600 11px sans-serif`

        nodes.forEach((node) => {
          if (node.x === undefined || node.y === undefined) return
          if (
            node.x < minX - padding ||
            node.x > maxX + padding ||
            node.y < minY - padding ||
            node.y > maxY + padding
          )
            return
          if (transform.k < 1.1 && (node.degree || 0) < 5 && focusNodeId !== node.id) return

          const radius = getNodeRadius(node)
          context.strokeText(node.name, node.x, node.y + radius + 4)
          context.fillText(node.name, node.x, node.y + radius + 4)
        })
      }

      context.restore()
    }

    simulation.on('tick', () => {
      quadtreeRef.current = d3
        .quadtree<D3Node>()
        .x((d) => d.x!)
        .y((d) => d.y!)
        .addAll(nodes)
      render()
    })

    // --- Standard Interactions (Drag/Zoom/Hover) ---
    const canvasSelection = d3.select(canvas)

    const findNodeAt = (x: number, y: number) => {
      if (!quadtreeRef.current) return null
      const transform = transformRef.current
      const [simX, simY] = transform.invert([x, y])
      const closest = quadtreeRef.current.find(simX, simY, 40 / transform.k)
      if (
        closest &&
        Math.hypot(simX - closest.x!, simY - closest.y!) < getNodeRadius(closest) + 5
      ) {
        return closest
      }
      return null
    }

    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.05, 3])
      .on('zoom', (e) => {
        transformRef.current = e.transform
        requestAnimationFrame(render)
      })
    zoomBehaviorRef.current = zoom

    const drag = d3
      .drag<HTMLCanvasElement, unknown>()
      .container(canvas)
      .subject((e) => {
        const [x, y] = d3.pointer(e, canvas)
        return findNodeAt(x, y)
      })
      .on('start', (e) => {
        if (!e.active) simulation.alphaTarget(0.3).restart()
        e.subject.fx = e.subject.x
        e.subject.fy = e.subject.y
        canvas.style.cursor = 'grabbing'
      })
      .on('drag', (e) => {
        e.subject.fx = e.x
        e.subject.fy = e.y
        simulation.alpha(0.1).restart()
      })
      .on('end', (e) => {
        if (!e.active) simulation.alphaTarget(0)
        e.subject.fx = null
        e.subject.fy = null
        canvas.style.cursor = 'grab'
      })

    canvasSelection.call(drag).call(zoom)

    canvasSelection.on('click', (e) => {
      if (e.defaultPrevented) return
      const [x, y] = d3.pointer(e, canvas)
      const node = findNodeAt(x, y)
      if (node && onNodeClick) onNodeClick(node)
    })

    canvasSelection.on('mousemove', (e) => {
      if (e.buttons === 1) return
      const [x, y] = d3.pointer(e, canvas)
      const node = findNodeAt(x, y)
      canvas.style.cursor = node ? 'pointer' : 'move'
    })

    return () => {
      simulation.stop()
      zoom.on('zoom', null)
    }
  }, [data, onNodeClick])
  // --- Auto-Fit / Reset ---
  // Updated to handle large graphs by zooming out more initially
  const handleFit = useCallback(() => {
    if (!canvasRef.current || !zoomBehaviorRef.current || nodesRef.current.length === 0) return

    // 1. Calculate Bounds
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    let validNodes = 0
    nodesRef.current.forEach((n) => {
      if (n.x === undefined || n.y === undefined) return
      if (n.x < minX) minX = n.x
      if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y
      if (n.y > maxY) maxY = n.y
      validNodes++
    })

    if (validNodes === 0) return

    const width = containerRef.current?.clientWidth || 800
    const height = containerRef.current?.clientHeight || 600
    const padding = 80

    const graphW = maxX - minX
    const graphH = maxY - minY
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2

    // 2. Calculate Scale
    // If graph is massive (10000px wide), this scale will be small (e.g. 0.05)
    const scale = Math.min(2, Math.min((width - padding) / graphW, (height - padding) / graphH))

    // 3. Apply Transform
    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-midX, -midY)

    d3.select(canvasRef.current)
      .transition()
      .duration(750)
      .call(zoomBehaviorRef.current.transform, transform)
  }, [])

  // --- Toolbar Handlers ---
  const handleZoom = (factor: number) => {
    if (canvasRef.current && zoomBehaviorRef.current) {
      d3.select(canvasRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, factor)
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen bg-slate-50 overflow-hidden shadow-inner rounded-none border-0'
          : 'relative w-full h-full bg-slate-50 overflow-hidden rounded-xl border border-slate-200 shadow-inner'
      }
    >
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />
      <div className="absolute bottom-4 left-4 pointer-events-none select-none">
        <div className="flex items-center gap-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-xs font-medium text-slate-600">
          <div className="flex items-center gap-2">
            <Box size={14} className="text-blue-500" />
            <span>
              <span className="text-slate-400 mr-1.5">Nodes:</span>
              <span className="text-slate-700 font-bold">{data.vertices.length}</span>
            </span>
          </div>
          <div className="w-px h-3 bg-slate-300"></div>
          <div className="flex items-center gap-2">
            <NetworkIcon size={14} className="text-violet-500" />
            <span>
              <span className="text-slate-400 mr-1.5">Edges:</span>
              <span className="text-slate-700 font-bold">{data.edges.length}</span>
            </span>
          </div>
        </div>
      </div>
      {/* Controls - Top Right */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={toggleFullscreen}
          className="p-2 bg-white rounded-lg shadow hover:bg-slate-50 border border-slate-200"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize size={20} className="text-slate-600" />
          ) : (
            <Maximize size={20} className="text-slate-600" />
          )}
        </button>
        <button
          onClick={handleFit}
          className="p-2 bg-white rounded-lg shadow hover:bg-slate-50 border border-slate-200"
          title="Fit to View"
        >
          <Box size={20} className="text-slate-600" />
        </button>
        <div className="flex flex-col bg-white rounded-lg shadow border border-slate-200">
          <button
            onClick={() => handleZoom(1.2)}
            className="p-2 hover:bg-slate-50 border-b border-slate-100"
          >
            <ZoomIn size={20} className="text-slate-600" />
          </button>
          <button onClick={() => handleZoom(0.8)} className="p-2 hover:bg-slate-50">
            <ZoomOut size={20} className="text-slate-600" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default DependencyGraphVisualizer
