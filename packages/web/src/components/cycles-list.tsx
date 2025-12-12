'use client'

import * as React from 'react'
import { List } from 'react-window'
import {
  ArrowRight,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  FileCode,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import useSWR from 'swr'
import { getConnectionsList } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { generatePermanentLink } from '@/lib/links'

export interface CycleNode {
  id: string
  name: string
}

export type Cycle = CycleNode[]

interface CyclesListProps {
  cycles: Cycle[]
  height?: number | string
  itemHeight?: number
  isLoading?: boolean
  error?: Error | null
  projectId?: string
  onCycleClick?: (cycle: Cycle) => void
}

interface RowProps {
  index: number
  style: React.CSSProperties
  cycles: Cycle[]
  onInspect: (cycle: Cycle) => void
}

type ViewMode = 'list' | 'detail'

const CycleRow = ({ index, style, cycles, onInspect }: RowProps) => {
  const cycle = cycles[index]
  const containerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [scrollMetrics, setScrollMetrics] = React.useState({ target: 0, duration: '0s' })

  const BASE_SPEED = 150 // px per second

  React.useEffect(() => {
    const updateMetrics = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const contentWidth = contentRef.current.scrollWidth
        const maxTranslate = contentWidth - containerWidth

        if (maxTranslate > 0) {
          const duration = maxTranslate / BASE_SPEED
          setScrollMetrics({
            target: -maxTranslate,
            duration: `${duration}s`,
          })
        } else {
          setScrollMetrics({ target: 0, duration: '0s' })
        }
      }
    }

    updateMetrics()

    // Use ResizeObserver to keep metrics accurate if window resizes
    const observer = new ResizeObserver(updateMetrics)
    if (containerRef.current) observer.observe(containerRef.current)
    if (contentRef.current) observer.observe(contentRef.current)

    return () => observer.disconnect()
  }, [cycles]) // Re-run if data changes (layout changes)

  return (
    <div
      style={
        {
          ...style,
          // Pass metrics as CSS variables
          '--target-tx': `${scrollMetrics.target}px`,
          '--duration': scrollMetrics.duration,
        } as React.CSSProperties
      }
      className="px-4 border-b border-gray-100 flex items-center gap-2 group w-full cursor-pointer hover:bg-gray-50 transition-colors relative"
      onClick={() => onInspect(cycle)}
    >
      <span className="font-mono text-xs text-gray-400 w-8 flex-shrink-0">#{index + 1}</span>

      {/* Left Fade (Visual only) - moved outside container interactions */}
      <div className="absolute left-0 top-0 bottom-0 w-12 z-20 bg-gradient-to-r from-white/50 to-transparent pointer-events-none" />

      <div
        ref={containerRef}
        className="flex-1 min-w-0 relative flex items-center overflow-hidden pb-1 h-full"
      >
        {/*
                    Right Hover Zone (Peer)
                    Must be a DIRECT SIBLING of the content div for peer-hover to work.
                    Positioned absolute relative to this container.
                */}
        <div
          className="peer absolute right-0 top-0 bottom-0 w-24 z-30 bg-gradient-to-l from-white/90 to-transparent"
          onClick={(e) => e.stopPropagation()}
        />

        <div
          ref={contentRef}
          className="flex items-center gap-1.5 whitespace-nowrap px-1 transition-transform ease-in will-change-transform transform translate-x-0 peer-hover:translate-x-[var(--target-tx)]"
          style={{ transitionDuration: 'var(--duration)' }}
        >
          {cycle.map((node, i) => (
            <React.Fragment key={`${node.id}-${i}`}>
              {i > 0 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
              <Link
                href={`/projects/${node.id}`}
                className="inline-flex items-center px-2 py-1 rounded-md bg-white border border-gray-200 text-xs hover:border-blue-300 hover:text-blue-600 transition-colors shadow-sm flex-shrink-0"
                title={node.name}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="truncate max-w-[200px]">{node.name}</span>
              </Link>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

function EdgeInspector({ from, to, index }: { from: CycleNode; to: CycleNode; index: number }) {
  const [isOpen, setIsOpen] = React.useState(false)

  // Only fetch when open
  const { data, error, isLoading } = useSWR(
    isOpen ? ['connections', from.name, to.name] : null,
    () =>
      getConnectionsList({
        fromNodeProjectName: from.name,
        toNodeProjectName: to.name,
        limit: 50,
      }),
  )

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="font-mono text-xs text-gray-500 w-6">#{index + 1}</span>
          <span className="font-medium text-gray-900 truncate">{from.name}</span>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 truncate">{to.name}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="border-t bg-white p-4">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-red-500 text-sm">Failed to load connections</div>
          ) : data?.data.length === 0 ? (
            <div className="text-gray-500 text-sm italic">
              No explicit file connections found (might be implicit).
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-xs font-semibold uppercase text-gray-500">
                  Connections ({data?.total})
                </span>
              </div>
              <div className="space-y-2">
                {data?.data.map((conn, i) => {
                  const fromNodeLink = generatePermanentLink(
                    conn.fromNode,
                    conn.fromNode.project?.addr,
                  )
                  const toNodeLink = generatePermanentLink(conn.toNode, conn.toNode.project?.addr)

                  return (
                    <div key={`${conn.id}-${i}`} className="flex items-start gap-3 text-sm group">
                      <FileCode className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-700">{conn.fromNode.name}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {conn.fromNode.type}
                          </Badge>
                        </div>
                        <div className="text-gray-500 text-xs flex items-center gap-1.5 flex-wrap">
                          {fromNodeLink ? (
                            <a
                              href={fromNodeLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-blue-600 hover:underline"
                            >
                              <span className="truncate">
                                {conn.fromNode.relativePath}:{conn.fromNode.startLine}
                              </span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          ) : (
                            <span className="truncate">
                              {conn.fromNode.relativePath}:{conn.fromNode.startLine}
                            </span>
                          )}
                          <span className="flex-shrink-0">&rarr;</span>
                          {toNodeLink ? (
                            <a
                              href={toNodeLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-blue-600 hover:underline"
                            >
                              <span className="truncate">
                                {conn.toNode.relativePath || 'External'}
                              </span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          ) : (
                            <span className="truncate">
                              {conn.toNode.relativePath || 'External'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// CycleDetailView component to show cycle details
function CycleDetailView({ cycle, onBack }: { cycle: Cycle; onBack: () => void }) {
  // Build edges from cycle
  const edges: { from: CycleNode; to: CycleNode }[] = []
  if (cycle.length > 0) {
    for (let i = 0; i < cycle.length - 1; i++) {
      edges.push({ from: cycle[i], to: cycle[i + 1] })
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="border-b px-6 py-4 bg-gray-50/50 flex items-center gap-4 h-14 shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          Back to List
        </Button>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Cycle Details</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {edges.length === 0 ? (
          <div className="text-center text-gray-500 py-10">No cycle selected</div>
        ) : (
          edges.map((edge, index) => (
            <EdgeInspector key={index} from={edge.from} to={edge.to} index={index} />
          ))
        )}
      </div>
    </div>
  )
}

export function CyclesList({
  cycles,
  itemHeight = 80,
  isLoading,
  error,
  projectId,
  onCycleClick,
}: CyclesListProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>('list')
  const [selectedCycle, setSelectedCycle] = React.useState<Cycle | null>(null)

  const handleInspect = (cycle: Cycle) => {
    // If onCycleClick is provided, use it instead of showing detail view
    if (onCycleClick) {
      onCycleClick(cycle)
      return
    }

    setSelectedCycle(cycle)

    // Use View Transition API if available
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      ;(document as any).startViewTransition(() => {
        setViewMode('detail')
      })
    } else {
      setViewMode('detail')
    }
  }

  const handleBack = () => {
    // Use View Transition API if available
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      ;(document as any).startViewTransition(() => {
        setViewMode('list')
      })
    } else {
      setViewMode('list')
    }
  }

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center border rounded-lg bg-white">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-gray-500">Loading cycles...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[60vh] flex items-center justify-center border rounded-lg bg-red-50 p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <h3 className="font-semibold text-red-900">Failed to load cycles</h3>
          <p className="text-red-700">{error.message || 'Unknown error occurred'}</p>
        </div>
      </div>
    )
  }

  if (!cycles || cycles.length === 0) {
    return (
      <div className="h-[60vh] flex items-center justify-center border rounded-lg bg-gray-50 border-dashed">
        <p className="text-gray-500">No circular dependencies found 🎉</p>
      </div>
    )
  }

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <CycleRow index={index} style={style} cycles={cycles} onInspect={handleInspect} />
  )

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden w-full h-[60vh] relative"
      style={{ viewTransitionName: 'cycle-container' } as React.CSSProperties}
    >
      {viewMode === 'list' ? (
        <>
          <div className="border-b px-6 py-4 bg-gray-50 flex justify-between items-center h-14 shrink-0">
            <h3 className="font-semibold text-gray-900">Detected Cycles</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
              {cycles.length} Total
            </span>
          </div>
          <div className="h-[calc(60vh-3.5rem)] w-full">
            <List<{}>
              style={{ height: '100%', width: '100%' }}
              rowCount={cycles.length}
              rowHeight={itemHeight}
              rowProps={{}}
              rowComponent={Row}
            />
          </div>
        </>
      ) : (
        <CycleDetailView cycle={selectedCycle || []} onBack={handleBack} />
      )}
    </div>
  )
}
