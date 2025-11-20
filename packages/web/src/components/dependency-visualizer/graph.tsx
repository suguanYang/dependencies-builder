import React, { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { DependencyGraph, D3Node, D3Link, EntityType } from '../types';
import { parseDependencyGraph } from '../utils/graphUtils';
import { ZoomIn, ZoomOut, Maximize, RefreshCw } from 'lucide-react';
import { AppType, NodeType } from '@/lib/api';

interface DependencyGraphVisualizerProps {
  data: DependencyGraph;
  onNodeClick?: (node: D3Node) => void;
}

// Visual Constants
const NODE_RADIUS = 25;
const LINK_DISTANCE = 120;
const CHARGE_STRENGTH = -400;


// Node type colors
const getNodeColor = (type: EntityType) => {
  // Handle AppType first
  if (type === AppType.App) return '#3b82f6'; // blue-500 for App
  if (type === AppType.Lib) return '#8b5cf6'; // violet-500 for Lib

  // Handle NodeType
  switch (type) {
    case NodeType.NamedExport: return '#3b82f6'; // blue-500
    case NodeType.NamedImport: return '#eab308'; // yellow-500
    case NodeType.RuntimeDynamicImport: return '#ec4899'; // pink-500
    case NodeType.GlobalVarRead: return '#8b5cf6'; // violet-500
    case NodeType.GlobalVarWrite: return '#10b981'; // emerald-500
    case NodeType.WebStorageRead: return '#f97316'; // orange-500
    case NodeType.WebStorageWrite: return '#22c55e'; // green-500
    case NodeType.EventOn: return '#06b6d4'; // cyan-500
    case NodeType.EventEmit: return '#ef4444'; // red-500
    case NodeType.DynamicModuleFederationReference: return '#8b5cf6'; // violet-500
    default: return '#6b7280'; // gray-500
  }
};


// Node type abbreviations
const getNodeAbbreviation = (type: EntityType) => {
  // Handle AppType first
  if (type === AppType.App) return 'A';
  if (type === AppType.Lib) return 'L';

  // Handle NodeType
  switch (type) {
    case NodeType.NamedExport: return 'NE';
    case NodeType.NamedImport: return 'NI';
    case NodeType.RuntimeDynamicImport: return 'RDI';
    case NodeType.GlobalVarRead: return 'GVR';
    case NodeType.GlobalVarWrite: return 'GVW';
    case NodeType.WebStorageRead: return 'WSR';
    case NodeType.WebStorageWrite: return 'WSW';
    case NodeType.EventOn: return 'EO';
    case NodeType.EventEmit: return 'EE';
    case NodeType.DynamicModuleFederationReference: return 'DMF';
    default: return 'N/A';
  }
};

const DependencyGraphVisualizer: React.FC<DependencyGraphVisualizerProps> = ({ data, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Keep simulation ref to control it
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Initialize D3 Graph
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data) return;

    const { nodes, links } = parseDependencyGraph(data);

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous SVG content
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Define Markers for Arrowheads
    const defs = svg.append('defs');

    // Forward arrow (for dependencies)
    defs.append('marker')
      .attr('id', 'arrowhead-forward')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 10) // Position arrow at the end of the line
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#3b82f6') // blue-500 for forward dependencies
      .style('stroke', 'none');

    // Reverse arrow (for dependents)
    defs.append('marker')
      .attr('id', 'arrowhead-reverse')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 10) // Position arrow at the end of the line
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#ef4444') // red-500 for reverse dependencies
      .style('stroke', 'none');

    // Main Group for Zooming
    const g = svg.append('g').attr('class', 'graph-container');

    // Initialize Simulation
    const simulation = d3.forceSimulation<D3Node, D3Link>(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links).id(d => d.id).distance(LINK_DISTANCE))
      .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(NODE_RADIUS * 1.5));

    simulationRef.current = simulation;

    // Draw Links
    const link = g.append('g')
      .attr('stroke', '#6b7280') // gray-500
      .attr('stroke-opacity', 0.8)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead-forward)');

    // Draw Nodes (Groups containing Circle + Label)
    const node = g.append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'cursor-pointer transition-opacity duration-200 hover:opacity-80')
      .on('click', (event, d) => {
        event.stopPropagation(); // Prevent background click
        if (onNodeClick) onNodeClick(d);
      });
      
    // Node Circles
    node.append('circle')
      .attr('r', NODE_RADIUS)
      .attr('fill', d => getNodeColor(d.type))
      .attr('class', 'shadow-lg');

    // Node Labels (Inside circle - Abbreviation based on type)
    node.append('text')
      .text(d => {
        // Check if this is a project entity (AppType)
        const isProjectNode = d.type === AppType.App || d.type === AppType.Lib;
        if (isProjectNode) {
          return d.type === AppType.App ? 'A' : 'L';
        }
        return getNodeAbbreviation(d.type);
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .attr('font-weight', 'normal')
      .attr('pointer-events', 'none'); // Let clicks pass to circle

    // External Labels (Below node)
    node.append('text')
      .text(d => {
        // Check if this is a project entity (AppType)
        const isProjectNode = d.type === AppType.App || d.type === AppType.Lib;
        if (isProjectNode) {
          return `${d.name} (${d.type})`;
        }
        return `${d.name}`;
      })
      .attr('x', 0)
      .attr('y', NODE_RADIUS + 15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#374151') // gray-700
      .attr('stroke', 'none') // Remove white stroke inherited from group
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .style('text-shadow', '0 1px 2px rgba(255,255,255,0.8)');

    // Drag Behavior
    const drag = d3.drag<SVGGElement, D3Node>()
      .on('start', function(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', function(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', function(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag as any);

    // Simulation Tick
    // Helper function to calculate intersection point with node circle
    const getIntersectionPoint = (source: D3Node, target: D3Node, radius: number) => {
      const dx = target.x! - source.x!;
      const dy = target.y! - source.y!;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance === 0) return { x: source.x!, y: source.y! };

      const unitX = dx / distance;
      const unitY = dy / distance;

      return {
        x: source.x! + unitX * radius,
        y: source.y! + unitY * radius
      };
    };

    simulation.on('tick', () => {
      link
        .attr('x1', d => {
          const source = d.source as D3Node;
          const target = d.target as D3Node;
          const intersection = getIntersectionPoint(source, target, NODE_RADIUS);
          return intersection.x;
        })
        .attr('y1', d => {
          const source = d.source as D3Node;
          const target = d.target as D3Node;
          const intersection = getIntersectionPoint(source, target, NODE_RADIUS);
          return intersection.y;
        })
        .attr('x2', d => {
          const source = d.target as D3Node;
          const target = d.source as D3Node;
          const intersection = getIntersectionPoint(source, target, NODE_RADIUS);
          return intersection.x;
        })
        .attr('y2', d => {
          const source = d.target as D3Node;
          const target = d.source as D3Node;
          const intersection = getIntersectionPoint(source, target, NODE_RADIUS);
          return intersection.y;
        });

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Zoom Behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);
    
    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data, onNodeClick]);


  // --- Control Handlers ---

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.2);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.8);
  }, []);

  const handleFitView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || !containerRef.current || !data) return;
    
    const { nodes } = parseDependencyGraph(data);
    if (nodes.length === 0) return;

    // Simple reset for now - in a production app, we'd calculate bounding box of all nodes
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    d3.select(svgRef.current).transition().duration(750).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(width/2, height/2).scale(1).translate(-width/2, -height/2) // Roughly center, better approach is calculating bounds
    );
    
    // Re-heat simulation to center
    simulationRef.current?.alpha(1).restart();
  }, [data]);


  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-50 overflow-hidden rounded-xl border border-slate-200 shadow-inner">
      <svg ref={svgRef} className="w-full h-full touch-none" />
      
      {/* Controls Overlay */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
         <button 
          onClick={handleFitView}
          className="p-2 bg-white rounded-lg shadow-md hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors"
          title="Fit View"
        >
          <Maximize size={20} />
        </button>
        <div className="flex flex-col bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
          <button 
            onClick={handleZoomIn}
            className="p-2 hover:bg-slate-50 text-slate-700 border-b border-slate-100 transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={20} />
          </button>
          <button 
            onClick={handleZoomOut}
            className="p-2 hover:bg-slate-50 text-slate-700 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DependencyGraphVisualizer;
