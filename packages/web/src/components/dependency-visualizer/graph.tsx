import React, { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import { DependencyGraph, D3Node, D3Link, EntityType } from '../types'
import { parseDependencyGraph } from '../utils/graphUtils'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { AppType, NodeType } from '@/lib/api'

interface DependencyGraphVisualizerProps {
  data: DependencyGraph
  onNodeClick?: (node: D3Node) => void
  focusNodeId: string
}

// --- Visual Constants & Helpers ---

// Increased base radius to ensure Abbr text fits inside
const getNodeRadius = (node: D3Node) => {
  const baseRadius = 16 // Minimum size to fit text
  const degree = node.degree || 0
  return baseRadius + Math.sqrt(degree) * 1.4
}

const getNodeColor = (type: EntityType) => {
  if (type === AppType.App) return '#3b82f6'
  if (type === AppType.Lib) return '#8b5cf6'

  switch (type) {
    case NodeType.NamedExport:
      return '#3b82f6'
    case NodeType.NamedImport:
      return '#eab308'
    case NodeType.RuntimeDynamicImport:
      return '#ec4899'
    case NodeType.GlobalVarRead:
      return '#8b5cf6'
    case NodeType.GlobalVarWrite:
      return '#10b981'
    case NodeType.WebStorageRead:
      return '#f97316'
    case NodeType.WebStorageWrite:
      return '#22c55e'
    case NodeType.EventOn:
      return '#06b6d4'
    case NodeType.EventEmit:
      return '#ef4444'
    case NodeType.DynamicModuleFederationReference:
      return '#8b5cf6'
    default:
      return '#6b7280'
  }
}

const getNodeAbbreviation = (type: EntityType) => {
  if (type === AppType.App) return 'APP'
  if (type === AppType.Lib) return 'LIB'

  switch (type) {
    case NodeType.NamedExport:
      return 'NE'
    case NodeType.NamedImport:
      return 'NI'
    case NodeType.RuntimeDynamicImport:
      return 'RDI'
    case NodeType.GlobalVarRead:
      return 'GR'
    case NodeType.GlobalVarWrite:
      return 'GW'
    case NodeType.WebStorageRead:
      return 'WR'
    case NodeType.WebStorageWrite:
      return 'WW'
    case NodeType.EventOn:
      return 'EO'
    case NodeType.EventEmit:
      return 'EE'
    case NodeType.DynamicModuleFederationReference:
      return 'DMF'
    default:
      return '?'
  }
}

const DependencyGraphVisualizer: React.FC<DependencyGraphVisualizerProps> = ({
  data,
  onNodeClick,
  focusNodeId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Refs for D3 state
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null)
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)
  const nodesRef = useRef<D3Node[]>([])

  // Main Effect: Init & Render Loop
  // ... imports and interfaces remain the same

  // Inside DependencyGraphVisualizer component:

  // Main Effect: Init & Render Loop
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !data) return

    // 1. Parse Data
    const { nodes, links } = parseDependencyGraph(data)
    nodesRef.current = nodes

    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const container = containerRef.current
    if (!context) return

    // 2. Setup Canvas DPI
    const width = container.clientWidth
    const height = container.clientHeight
    const dpr = window.devicePixelRatio || 1

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.scale(dpr, dpr)

    // 3. Stop previous simulation
    if (simulationRef.current) simulationRef.current.stop()

    // 4. Force Simulation
    const simulation = d3
      .forceSimulation<D3Node, D3Link>(nodes)
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Link>(links)
          .id((d) => d.id)
          .distance((d) => {
            const sourceDeg = (d.source as D3Node).degree || 1
            const targetDeg = (d.target as D3Node).degree || 1
            return 80 + Math.sqrt(Math.max(sourceDeg, targetDeg)) * 10
          }),
      )
      .force(
        'charge',
        d3.forceManyBody().strength((d: any) => -400 - d.degree * 20),
      )
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force(
        'collide',
        d3
          .forceCollide()
          .radius((d: any) => getNodeRadius(d) + 20)
          .iterations(2),
      )

    simulationRef.current = simulation

    // --- Helper: Find Node ---
    const findNodeAt = (x: number, y: number) => {
      // 1. Get current zoom transform
      const transform = transformRef.current
      // 2. Invert screen coord to world coord
      const [simX, simY] = transform.invert([x, y])

      let closest: D3Node | null = null
      let minDst = Infinity

      for (const node of nodes) {
        if (node.x === undefined || node.y === undefined) continue
        const dist = Math.hypot(simX - node.x, simY - node.y)
        const radius = getNodeRadius(node)

        // Strict hit area (radius + 5px buffer)
        if (dist < radius + 5 && dist < minDst) {
          minDst = dist
          closest = node
        }
      }
      return closest
    }

    // --- Render Function ---
    const render = () => {
      context.save()
      context.clearRect(0, 0, width, height)

      context.translate(transformRef.current.x, transformRef.current.y)
      context.scale(transformRef.current.k, transformRef.current.k)

      // A. Draw Links
      context.lineWidth = 1.5
      context.strokeStyle = '#e5e7eb'
      context.beginPath()
      links.forEach((link) => {
        const source = link.source as D3Node
        const target = link.target as D3Node
        if (
          source.x !== undefined &&
          source.y !== undefined &&
          target.x !== undefined &&
          target.y !== undefined
        ) {
          context.moveTo(source.x, source.y)
          context.lineTo(target.x, target.y)
        }
      })
      context.stroke()

      // B. Draw Nodes
      nodes.forEach((node) => {
        if (node.x === undefined || node.y === undefined) return
        const radius = getNodeRadius(node)
        const isFocused = focusNodeId === node.id

        // Focus Glow
        if (isFocused) {
          context.beginPath()
          context.fillStyle = 'rgba(59, 130, 246, 0.3)'
          context.arc(node.x, node.y, radius + 8, 0, 2 * Math.PI)
          context.fill()
        }

        // Node Circle
        context.beginPath()
        context.fillStyle = getNodeColor(node.type)
        context.arc(node.x, node.y, radius, 0, 2 * Math.PI)
        context.fill()
        context.strokeStyle = isFocused ? '#1d4ed8' : '#ffffff'
        context.lineWidth = isFocused ? 3 : 1.5
        context.stroke()

        // Abbreviation Text
        if (transformRef.current.k > 0.15) {
          const abbr = getNodeAbbreviation(node.type)
          context.fillStyle = '#ffffff'
          const fontSize = Math.min(radius, 14)
          context.font = `700 ${fontSize}px sans-serif`
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          context.fillText(abbr, node.x, node.y + 1)
        }
      })

      // C. Draw Labels (Optional: Only when zoomed in)
      if (transformRef.current.k > 0.6) {
        context.textAlign = 'center'
        context.textBaseline = 'top'
        nodes.forEach((node) => {
          if ((node.degree || 0) < 5 && transformRef.current.k < 1.2) return
          if (node.x === undefined || node.y === undefined) return

          const radius = getNodeRadius(node)
          context.fillStyle = '#1e293b'
          context.font = '10px sans-serif'
          context.strokeStyle = 'rgba(255,255,255,0.8)'
          context.lineWidth = 3
          context.strokeText(node.name, node.x, node.y + radius + 4)
          context.fillText(node.name, node.x, node.y + radius + 4)
        })
      }

      context.restore()
    }

    simulation.on('tick', render)

    // 5. Interactions
    const canvasSelection = d3.select(canvas)

    // --- Drag Behavior (Define BEFORE Zoom) ---
    const drag = d3
      .drag<HTMLCanvasElement, unknown>()
      .container(canvas)
      .subject((event) => {
        // FIX: Use d3.pointer to get [x,y] relative to the canvas
        const [x, y] = d3.pointer(event, canvas)
        // Find node at those coordinates
        return findNodeAt(x, y)
      })
      .on('start', (event) => {
        // If subject returned null, this event never fires
        if (!event.active) simulation.alphaTarget(0.3).restart()

        const node = event.subject as D3Node
        node.fx = node.x
        node.fy = node.y

        canvas.style.cursor = 'grabbing'
      })
      .on('drag', (event) => {
        const node = event.subject as D3Node
        // event.x/y are automatically transformed by d3-drag
        // to match the subject's coordinate system (world coordinates)
        node.fx = event.x
        node.fy = event.y
      })
      .on('end', (event) => {
        if (!event.active) simulation.alphaTarget(0)
        const node = event.subject as D3Node
        node.fx = null
        node.fy = null
        canvas.style.cursor = 'grab'
      })

    // --- Zoom Behavior ---
    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (e) => {
        transformRef.current = e.transform
        render()
      })

    zoomBehaviorRef.current = zoom

    // Apply Drag FIRST, then Zoom
    // If Drag.subject returns a node, Drag consumes the event.
    // If Drag.subject returns null, the event passes to Zoom.
    canvasSelection.call(drag).call(zoom)

    // --- Click Handling ---
    canvasSelection.on('click', (event) => {
      // Ignore clicks that happened during a drag gesture
      if (event.defaultPrevented) return

      const [x, y] = d3.pointer(event, canvas)
      const node = findNodeAt(x, y)
      if (node && onNodeClick) {
        onNodeClick(node)
      }
    })

    // --- Mouse Move (Cursor) ---
    canvasSelection.on('mousemove', (event) => {
      // Don't update cursor while dragging
      if (event.buttons === 1) return

      const [x, y] = d3.pointer(event, canvas)
      const node = findNodeAt(x, y)
      canvas.style.cursor = node ? 'pointer' : 'move'
    })

    return () => {
      simulation.stop()
      zoom.on('zoom', null)
      drag.on('start', null).on('drag', null).on('end', null)
    }
  }, [data, onNodeClick])
  // --- Focus Animation Effect ---
  useEffect(() => {
    if (!focusNodeId || !canvasRef.current || !zoomBehaviorRef.current) return
    const node = nodesRef.current.find((n) => n.id === focusNodeId)
    if (node && node.x && node.y) {
      const canvas = d3.select(canvasRef.current)
      const width = containerRef.current?.clientWidth || 800
      const height = containerRef.current?.clientHeight || 600

      const targetTransform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(1.5)
        .translate(-node.x, -node.y)

      canvas.transition().duration(1000).call(zoomBehaviorRef.current.transform, targetTransform)
    }
  }, [focusNodeId])

  // --- Toolbar Handlers ---
  const handleZoom = (factor: number) => {
    if (canvasRef.current && zoomBehaviorRef.current) {
      d3.select(canvasRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, factor)
    }
  }

  const handleFit = () => {
    if (!canvasRef.current || !zoomBehaviorRef.current || nodesRef.current.length === 0) return

    // Calculate Bounding Box
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity

    nodesRef.current.forEach((n) => {
      // FIX: Check BOTH x and y. If either is undefined, skip this node.
      if (n.x === undefined || n.y === undefined) return

      if (n.x < minX) minX = n.x
      if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y
      if (n.y > maxY) maxY = n.y
    })

    // If no valid nodes were found (e.g. simulation hasn't ticked yet), exit
    if (minX === Infinity || minY === Infinity) return

    const padding = 100
    const width = containerRef.current?.clientWidth || 800
    const height = containerRef.current?.clientHeight || 600
    const dx = maxX - minX
    const dy = maxY - minY
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2

    // Calculate scale to fit
    const scale = Math.max(0.1, Math.min(2, 0.9 / Math.max(dx / width, dy / height)))

    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-midX, -midY)

    d3.select(canvasRef.current)
      .transition()
      .duration(750)
      .call(zoomBehaviorRef.current.transform, transform)
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-slate-50 overflow-hidden rounded-xl border border-slate-200 shadow-inner"
    >
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={handleFit}
          className="p-2 bg-white rounded-lg shadow hover:bg-slate-50 border border-slate-200"
        >
          <Maximize size={20} className="text-slate-600" />
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
