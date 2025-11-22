import React, { useEffect, useRef, useCallback, useState } from 'react';
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

// Dynamic radius based on connection count (degree)
const getNodeRadius = (node: D3Node) => {
  const baseRadius = 4
  const degree = node.degree
  // Logarithmic scale prevents massive nodes from taking over screen, but allows growth
  // sqrt(degree) is also good: 100 connections = 10 * factor
  return baseRadius + Math.sqrt(degree) * 1.5
};

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs to keep track of simulation state across renders without triggering re-renders
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const nodesRef = useRef<D3Node[]>([]);
  
  // Initialize Graph
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !data) return;

    const { nodes, links } = parseDependencyGraph(data);
    nodesRef.current = nodes;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Handle High DPI Screens
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(dpr, dpr);

    // Cleanup old simulation
    if (simulationRef.current) simulationRef.current.stop();

    // Initialize Force Simulation
    const simulation = d3.forceSimulation<D3Node, D3Link>(nodes)
      .force("link", d3.forceLink<D3Node, D3Link>(links)
        .id(d => d.id)
        .distance((d) => {
            // Dynamic link distance: Hot nodes need longer links to fan out their neighbors
            const source = d.source as D3Node;
            const target = d.target as D3Node;
            const sourceDeg = source.degree;
            const targetDeg = target.degree;
            
            // Base distance 100, add length for busy nodes
            return 100 + Math.sqrt(Math.max(sourceDeg, targetDeg)) * 10;
        })
      ) 
      .force("charge", d3.forceManyBody()
        .strength((d: any) => {
            const degree = d.degree;
            // Standard nodes have -400. Hot nodes get much stronger repulsion (up to -2000)
            // to push the clutter away.
            return -400 - (degree * 20);
        })
        .distanceMax(4000)
      ) 
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide()
        .radius((d: any) => {
            // Collision radius slightly larger than visual radius + text padding
            return getNodeRadius(d) + 25; 
        })
        .iterations(2)
      );

    simulationRef.current = simulation;

    // Render Function
    const render = () => {
      context.save();
      context.clearRect(0, 0, width, height);
      
      // Apply Zoom Transform
      context.translate(transformRef.current.x, transformRef.current.y);
      context.scale(transformRef.current.k, transformRef.current.k);

      // Draw Links (Batch drawing for performance)
      context.beginPath();
      context.lineWidth = 1.5; 
      
      links.forEach(link => {
        const source = link.source as D3Node;
        const target = link.target as D3Node;
        
        if (source.x !== undefined && source.y !== undefined && target.x !== undefined && target.y !== undefined) {
            context.moveTo(source.x, source.y);
            context.lineTo(target.x, target.y);
        }
      });
      
      context.strokeStyle = '#e5e7eb'; // gray-200
      context.globalAlpha = 0.5; // Slightly transparent
      context.stroke();
      context.globalAlpha = 1;

      // Draw Directional Arrows
      // Use a higher zoom threshold to keep the view clean when zoomed out
      if (transformRef.current.k > 0.35) {
          context.beginPath();
          context.fillStyle = '#94a3b8'; // slate-400
          
          links.forEach(link => {
            const source = link.source as D3Node;
            const target = link.target as D3Node;
            
            if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return;
            
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Optimization: Skip arrows on very short links
            if (dist < 40) return;

            // Place arrow at ~60% of the path (closer to target to indicate direction)
            // but proportional, so they don't form a hard ring around hot nodes
            const ratio = 0.6; 
            
            const arrowX = source.x + dx * ratio;
            const arrowY = source.y + dy * ratio;

            const arrowLength = 6;
            const arrowWidth = 2.5;

            // Normalized vector
            const nx = dx / dist;
            const ny = dy / dist;

            // Arrow Tip (centered around arrowX/Y for the segment)
            const tipX = arrowX + nx * (arrowLength / 2);
            const tipY = arrowY + ny * (arrowLength / 2);

            // Arrow Base
            const baseX = arrowX - nx * (arrowLength / 2);
            const baseY = arrowY - ny * (arrowLength / 2);

            // Orthogonal vector for width
            const px = -ny;
            const py = nx;

            // Draw triangle
            context.moveTo(tipX, tipY);
            context.lineTo(baseX + px * arrowWidth, baseY + py * arrowWidth);
            context.lineTo(baseX - px * arrowWidth, baseY - py * arrowWidth);
            context.closePath();
          });
          context.fill();
      }

      // Draw Nodes
      nodes.forEach(node => {
        if (node.x === undefined || node.y === undefined) return;
        
        const radius = getNodeRadius(node);
        
        context.beginPath();
        context.fillStyle = getNodeColor(node.type);
        context.moveTo(node.x + radius, node.y);
        context.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        context.fill();
        
        // Border
        context.strokeStyle = '#ffffff';
        context.lineWidth = (node.degree || 0) > 20 ? 2 : 1.5; // Thicker border for hot nodes
        context.stroke();
      });

      // Draw Labels
      // Show labels earlier (zoom > 0.3)
      if (transformRef.current.k > 0.3) {
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.lineJoin = 'round';

          nodes.forEach(node => {
            if (node.x === undefined || node.y === undefined) return;
            
            // Determine font size based on node importance
            const radius = getNodeRadius(node);
            const isHot = (node.degree || 0) > 15;
            const fontSize = isHot ? 14 : 12;
            const fontWeight = isHot ? 'bold' : 'normal';
            
            context.font = `${fontWeight} ${fontSize}px sans-serif`;
            
            const labelY = node.y + radius + fontSize;

            // Draw Halo (White Stroke) to clear background behind text
            context.lineWidth = 3;
            context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            context.strokeText(node.name, node.x, labelY);
            
            // Draw Text
            context.fillStyle = isHot ? '#1e293b' : '#475569'; // Darker for hot nodes
            context.fillText(node.name, node.x, labelY);
          });
      }

      context.restore();
    };

    simulation.on('tick', render);

    // Setup Zoom Behavior
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.01, 4]) 
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        render();
      });

    d3.select(canvas).call(zoom);
    
    // Drag Interaction
    const drag = d3.drag<HTMLCanvasElement, unknown>()
        .subject((event) => {
            const [x, y] = transformRef.current.invert(d3.pointer(event, canvas));
            let closestNode: D3Node | null = null;
            let minDistance = Infinity;

            for (const node of nodes) {
                if (node.x === undefined || node.y === undefined) continue;
                const dx = x - node.x;
                const dy = y - node.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                // Check if click is within node radius + margin
                const hitRadius = Math.max(30, getNodeRadius(node) + 10);
                
                if (dist < hitRadius && dist < minDistance) {
                    minDistance = dist;
                    closestNode = node;
                }
            }
            return closestNode;
        })
        .on("start", (event) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        })
        .on("drag", (event) => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        })
        .on("end", (event) => {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        });

    d3.select(canvas).call(drag);

    // Click Interaction
    d3.select(canvas).on("click", (event) => {
        const [x, y] = transformRef.current.invert(d3.pointer(event, canvas));
        let clickedNode: D3Node | null = null;
        let minDistance = Infinity;

        for (const node of nodes) {
            if (node.x === undefined || node.y === undefined) continue;
            const dx = x - node.x;
            const dy = y - node.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            const hitRadius = Math.max(20, getNodeRadius(node) + 5);

            if (dist < hitRadius && dist < minDistance) {
                minDistance = dist;
                clickedNode = node;
            }
        }

        if (clickedNode && onNodeClick) {
            onNodeClick(clickedNode);
        }
    });

    // Mouse Move (Cursor)
    d3.select(canvas).on("mousemove", (event) => {
        const [x, y] = transformRef.current.invert(d3.pointer(event, canvas));
        let isHovering = false;
        for (const node of nodes) {
             if (node.x === undefined || node.y === undefined) continue;
             const dx = x - node.x;
             const dy = y - node.y;
             const dist = Math.sqrt(dx*dx + dy*dy);
             const hitRadius = Math.max(20, getNodeRadius(node) + 5);
             if (dist < hitRadius) {
                 isHovering = true;
                 break;
             }
        }
        canvas.style.cursor = isHovering ? 'pointer' : 'grab';
    });


    return () => {
      simulation.stop();
    };
  }, [data, onNodeClick]);

  // Controls
  const handleZoom = useCallback((factor: number) => {
      if (!canvasRef.current) return;
      const canvas = d3.select(canvasRef.current);
      canvas.transition().duration(300).call(d3.zoom().scaleBy as any, factor);
  }, []);

  const handleFit = useCallback(() => {
     if (!canvasRef.current || !containerRef.current) return;
     const canvas = d3.select(canvasRef.current);
     const width = containerRef.current.clientWidth;
     const height = containerRef.current.clientHeight;
     canvas.transition().duration(750).call(
         d3.zoom().transform as any, 
         d3.zoomIdentity.translate(width/2, height/2).scale(0.15).translate(-width/2, -height/2) 
    );
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-50 overflow-hidden rounded-xl border border-slate-200 shadow-inner">
      <canvas ref={canvasRef} className="block touch-none" />
      
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
         <button 
          onClick={handleFit}
          className="p-2 bg-white rounded-lg shadow-md hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors"
          title="Fit View"
        >
          <Maximize size={20} />
        </button>
        <div className="flex flex-col bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
          <button 
            onClick={() => handleZoom(1.2)}
            className="p-2 hover:bg-slate-50 text-slate-700 border-b border-slate-100 transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={20} />
          </button>
          <button 
            onClick={() => handleZoom(0.8)}
            className="p-2 hover:bg-slate-50 text-slate-700 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={20} />
          </button>
        </div>
      </div>
      
      <div className="absolute bottom-4 left-4 pointer-events-none">
        <div className="bg-white/80 backdrop-blur p-2 rounded-lg border border-slate-200 shadow-sm text-[10px] text-slate-500">
            Displaying {data.vertices.length} nodes (Canvas Renderer)
        </div>
      </div>
    </div>
  );
};
export default DependencyGraphVisualizer;
