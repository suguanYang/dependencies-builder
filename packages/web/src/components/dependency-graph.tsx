'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3'

interface Node extends SimulationNodeDatum {
  id: string
  name: string
  project: string
  type: number
  branch: string
}

interface Connection {
  id: string
  fromId: string
  toId: string
}

interface DependencyGraphProps {
  nodes: Node[]
  connections: Connection[]
  width?: number
  height?: number
}

export function DependencyGraph({ 
  nodes, 
  connections, 
  width = 800, 
  height = 600 
}: DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>(null)

  const d3Connections: SimulationLinkDatum<SimulationNodeDatum>[] = useMemo(() => {
    const _conn = [];
    for (const conn of connections) {
      const source = nodes.find(n => n.id === conn.fromId)
      const target = nodes.find(n => n.id === conn.toId)
      if (source && target) {
        _conn.push({
          ...conn,
          source: source,
          target: target
        })
      }
    }
    return _conn
  }, [connections, nodes])

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Create zoom behavior
    zoomRef.current = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svg.call(zoomRef.current)


    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(d3Connections).id((d: any) => d.id))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))

    const container = svg.append('g').attr('class', 'container')

    const link = container.append('g')
      .selectAll('line')
      .data(d3Connections)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)

    const node = container.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('r', 8)
      .attr('fill', (d) => getNodeColor(d.type))
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any
      )

    const label = container.append('g')
      .selectAll('text')
      .data(nodes)
      .enter().append('text')
      .text((d) => d.name)
      .attr('font-size', '12px')
      .attr('dx', 12)
      .attr('dy', 4)

    node.append('title')
      .text((d) => `${d.name}\n${d.project}\n${getTypeName(d.type)}`)

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => typeof d.source === 'object' ? d.source.x : 0)
        .attr('y1', (d: any) => typeof d.source === 'object' ? d.source.y : 0)
        .attr('x2', (d: any) => typeof d.target === 'object' ? d.target.x : 0)
        .attr('y2', (d: any) => typeof d.target === 'object' ? d.target.y : 0)

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y)

      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y)
    })

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: any) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    return () => {
      simulation.stop()
    }
  }, [nodes, d3Connections, width, height])

  const handleResetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleResetZoom}
        className="absolute top-2 right-2 bg-white border border-gray-300 rounded px-2 py-1 text-sm shadow-sm hover:bg-gray-50 z-10"
      >
        Reset Zoom
      </button>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border rounded-lg"
      />
    </div>
  )
}

function getNodeColor(type: number): string {
  const colors = [
    '#3b82f6', // blue - NamedExport
    '#ef4444', // red - NamedImport  
    '#f59e0b', // amber - RuntimeDynamicImport
    '#10b981', // emerald - Externals
    '#8b5cf6', // violet - GlobalState
    '#ec4899', // pink - EventOn
    '#06b6d4', // cyan - EventEmit
    '#f97316', // orange - DynamicModuleFederationReference
  ]
  return colors[type] || '#6b7280'
}

function getTypeName(type: number): string {
  const names = [
    'NamedExport',
    'NamedImport',
    'RuntimeDynamicImport', 
    'Externals',
    'GlobalState',
    'EventOn',
    'EventEmit',
    'DynamicModuleFederationReference'
  ]
  return names[type] || 'Unknown'
}