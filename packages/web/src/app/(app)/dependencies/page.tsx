'use client'

import React, { useState, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import useSWR, { SWRConfig } from 'swr'
import { GitBranch, Folder, AlertCircle } from 'lucide-react'
import DependencyGraphVisualizer from '@/components/dependency-visualizer/graph'
import NodePanel from '@/components/dependency-visualizer/panel'
import { ProjectSelector } from '@/components/project-selector'
import { NodeIdInput } from '@/components/node-id-input'
import { DependencyGraph, D3Node } from '@/components/types'
import {
  Project,
  getProjectById,
  getProjectDependencies,
  getNodeDependencies,
  getNodeById,
} from '@/lib/api'
import { swrConfig } from '@/lib/swr-config'

function DependenciesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [selectedNode, setSelectedNode] = useState<D3Node | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | undefined>(undefined)
  const [nodeId, setNodeId] = useState<string>('')
  const [viewMode, setViewMode] = useState<'project' | 'node'>('project')
  const [depth, setDepth] = useState<number>(1)
  const [branch, setBranch] = useState<string>('test')

  // Project dependencies SWR
  const {
    data: projectGraphData,
    error: projectError,
    isLoading: projectLoading,
  } = useSWR(
    selectedProject ? ['project-dependencies', selectedProject.id, depth, branch] : null,
    () => getProjectDependencies(selectedProject!.id, depth, branch),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  )

  // Node dependencies SWR
  const {
    data: nodeGraphData,
    error: nodeError,
    isLoading: nodeLoading,
  } = useSWR(
    nodeId ? ['node-dependencies', nodeId, depth] : null,
    () => getNodeDependencies(nodeId, depth),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  )

  // Determine which data to use based on view mode
  const graphData = viewMode === 'project' ? projectGraphData : nodeGraphData
  const error = viewMode === 'project' ? projectError : nodeError
  const loading = viewMode === 'project' ? projectLoading : nodeLoading

  // Initialize from query parameters
  useEffect(() => {
    const projectId = searchParams.get('projectId')
    const nodeIdParam = searchParams.get('nodeId')
    const mode = searchParams.get('mode') as 'project' | 'node' | null
    const depthParam = searchParams.get('depth')
    const branchParam = searchParams.get('branch')

    if (projectId) {
      setViewMode('project')
      // Fetch the project by ID and set it in the selector
      getProjectById(projectId).then(setSelectedProject)
    } else if (nodeIdParam) {
      setViewMode('node')
      setNodeId(nodeIdParam)
      // getNodeById(nodeIdParam).then(setSelectedNode)
    } else if (mode) {
      setViewMode(mode)
    }

    if (depthParam) {
      const depthValue = parseInt(depthParam, 10)
      if (!isNaN(depthValue) && depthValue >= 1 && depthValue <= 10) {
        setDepth(depthValue)
      }
    }

    if (branchParam) {
      setBranch(branchParam)
    }
  }, [searchParams])

  const handleProjectChange = (project: Project | undefined) => {
    setSelectedProject(project)
    // Update URL with projectId parameter
    const params = new URLSearchParams()
    if (project) {
      params.set('projectId', project.id)
    }
    params.set('mode', 'project')
    params.set('depth', depth.toString())
    params.set('branch', branch)
    router.replace(`/dependencies?${params.toString()}`, { scroll: false })
  }

  const handleNodeIdChange = (newNodeId: string | undefined) => {
    setNodeId(newNodeId || '')
    // Update URL with nodeId parameter
    const params = new URLSearchParams()
    if (newNodeId) {
      params.set('nodeId', newNodeId)
    }
    params.set('mode', 'node')
    params.set('depth', depth.toString())
    params.set('branch', branch)
    router.replace(`/dependencies?${params.toString()}`, { scroll: false })
  }

  const handleViewModeChange = (newMode: 'project' | 'node') => {
    setViewMode(newMode)
    setSelectedNode(null)
    setSelectedProject(undefined)
    // Update URL with mode parameter and clear projectId/nodeId when switching modes
    const params = new URLSearchParams()
    params.set('mode', newMode)
    params.set('depth', depth.toString())
    params.set('branch', branch)

    // Keep the current selection if switching to the same mode
    if (newMode === 'project' && selectedProject) {
      params.set('projectId', selectedProject.id)
    } else if (newMode === 'node' && nodeId) {
      params.set('nodeId', nodeId)
    }

    router.replace(`/dependencies?${params.toString()}`, { scroll: false })
  }

  const handleDepthChange = (newDepth: number) => {
    setDepth(newDepth)
    // Update URL with depth parameter
    const params = new URLSearchParams()
    params.set('mode', viewMode)
    params.set('depth', newDepth.toString())
    params.set('branch', branch)

    // Keep current selection
    if (viewMode === 'project' && selectedProject) {
      params.set('projectId', selectedProject.id)
    } else if (viewMode === 'node' && nodeId) {
      params.set('nodeId', nodeId)
    }

    router.replace(`/dependencies?${params.toString()}`, { scroll: false })
  }

  const handleBranchChange = (newBranch: string) => {
    setBranch(newBranch)
    // Update URL with branch parameter
    const params = new URLSearchParams()
    params.set('mode', viewMode)
    params.set('depth', depth.toString())
    params.set('branch', newBranch)

    // Keep current selection
    if (viewMode === 'project' && selectedProject) {
      params.set('projectId', selectedProject.id)
    } else if (viewMode === 'node' && nodeId) {
      params.set('nodeId', nodeId)
    }

    router.replace(`/dependencies?${params.toString()}`, { scroll: false })
  }

  const handleNodeClick = useCallback(
    (node: D3Node) => {
      setSelectedNode(node)
    },
    [setSelectedNode],
  )

  const handleClosePanel = () => {
    setSelectedNode(null)
  }

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dependency Visualization</h1>
          <p className="text-gray-600 mt-1">
            Explore and visualize dependencies between nodes and projects
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange('project')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'project'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Project View
              </div>
            </button>
            <button
              onClick={() => handleViewModeChange('node')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'node'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Node View
              </div>
            </button>
          </div>

          {/* Depth and Branch Inputs */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Depth:</label>
              <input
                type="number"
                value={depth}
                onChange={(e) => handleDepthChange(parseInt(e.target.value, 10))}
                min="1"
                max="10"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Branch:</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter branch..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Project Selection */}
      {viewMode === 'project' && (
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Project</label>
            <ProjectSelector
              value={selectedProject}
              onValueChange={handleProjectChange}
              placeholder="Choose a project..."
            />
          </div>
        </div>
      )}

      {/* Node Selection */}
      {viewMode === 'node' && (
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">Enter Node ID</label>
            <NodeIdInput
              value={nodeId}
              onValueChange={handleNodeIdChange}
              placeholder="Enter node ID..."
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Graph Visualization */}
      <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-white relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading dependency graph...</p>
            </div>
          </div>
        ) : graphData ? (
          <DependencyGraphVisualizer
            data={graphData}
            onNodeClick={handleNodeClick}
            focusNodeId={viewMode === 'project' ? selectedProject?.id! : nodeId}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <GitBranch className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Graph Loaded</h3>
              <p className="text-gray-600">
                {viewMode === 'project'
                  ? 'Select a project to visualize its dependencies'
                  : 'Enter a node ID to visualize its dependency graph'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Node Panel */}
      <NodePanel node={selectedNode} onClose={handleClosePanel} />
    </div>
  )
}

export default function DependenciesPage() {
  return (
    <SWRConfig value={swrConfig}>
      <Suspense
        fallback={<div className="min-h-screen bg-gray-50 p-6">Loading dependencies...</div>}
      >
        <DependenciesContent />
      </Suspense>
    </SWRConfig>
  )
}
