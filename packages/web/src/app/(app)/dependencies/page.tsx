'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { GitBranch, Folder, AlertCircle } from 'lucide-react'
import DependencyGraphVisualizer from '@/components/dependency-visualizer/graph'
import NodePanel from '@/components/dependency-visualizer/panel'
import { ProjectSelector } from '@/components/project-selector'
import { NodeIdInput } from '@/components/node-id-input'
import { DependencyGraph, D3Node } from '@/components/types'
import { Project, getProjectById } from '@/lib/api'

export default function DependenciesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [selectedNode, setSelectedNode] = useState<D3Node | null>(null)
  const [graphData, setGraphData] = useState<DependencyGraph | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | undefined>(undefined)
  const [nodeId, setNodeId] = useState<string>('')
  const [viewMode, setViewMode] = useState<'project' | 'node'>('project')

  // Initialize from query parameters
  useEffect(() => {
    const projectId = searchParams.get('projectId')
    const nodeIdParam = searchParams.get('nodeId')
    const mode = searchParams.get('mode') as 'project' | 'node' | null

    if (projectId) {
      setViewMode('project')
      // Fetch the project by ID and set it in the selector
      const fetchProject = async () => {
        try {
          const project = await getProjectById(projectId)
          setSelectedProject(project)
          fetchProjectDependencies(projectId)
        } catch (error) {
          console.error('Failed to fetch project:', error)
          setError('Failed to load project')
        }
      }
      fetchProject()
    } else if (nodeIdParam) {
      setViewMode('node')
      setNodeId(nodeIdParam)
      fetchNodeDependencies(nodeIdParam)
    } else if (mode) {
      setViewMode(mode)
    }
  }, [searchParams])

  // Reset graph data when switching between views
  useEffect(() => {
    setGraphData(null)
    setSelectedProject(undefined)
    setNodeId('')
    setSelectedNode(null)
    setError(null)
  }, [viewMode])

  const fetchProjectDependencies = async (projectId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/dependencies/projects/${projectId}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch project dependencies')
      }
      const data = await response.json()
      setGraphData(data)
    } catch (err) {
      console.error('Error fetching project dependencies:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dependencies')
    } finally {
      setLoading(false)
    }
  }

  const fetchNodeDependencies = async (nodeId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/dependencies/nodes/${nodeId}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch node dependencies')
      }
      const data = await response.json()
      setGraphData(data)
    } catch (err) {
      console.error('Error fetching node dependencies:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dependencies')
    } finally {
      setLoading(false)
    }
  }

  const handleProjectChange = (project: Project | undefined) => {
    setSelectedProject(project)
    if (project) {
      fetchProjectDependencies(project.id)
      // Update URL with projectId parameter
      const params = new URLSearchParams()
      params.set('projectId', project.id)
      params.set('mode', 'project')
      router.replace(`/dependencies?${params.toString()}`, { scroll: false })
    } else {
      setGraphData(null)
      // Remove projectId parameter from URL
      const params = new URLSearchParams()
      params.set('mode', 'project')
      router.replace(`/dependencies?${params.toString()}`, { scroll: false })
    }
  }

  const handleNodeIdChange = (newNodeId: string | undefined) => {
    setNodeId(newNodeId || '')
    if (newNodeId) {
      fetchNodeDependencies(newNodeId)
      // Update URL with nodeId parameter
      const params = new URLSearchParams()
      params.set('nodeId', newNodeId)
      params.set('mode', 'node')
      router.replace(`/dependencies?${params.toString()}`, { scroll: false })
    } else {
      setGraphData(null)
      // Remove nodeId parameter from URL
      const params = new URLSearchParams()
      params.set('mode', 'node')
      router.replace(`/dependencies?${params.toString()}`, { scroll: false })
    }
  }

  const handleViewModeChange = (newMode: 'project' | 'node') => {
    setViewMode(newMode)
    // Update URL with mode parameter and clear projectId/nodeId when switching modes
    const params = new URLSearchParams()
    params.set('mode', newMode)

    // Keep the current selection if switching to the same mode
    if (newMode === 'project' && selectedProject) {
      params.set('projectId', selectedProject.id)
    } else if (newMode === 'node' && nodeId) {
      params.set('nodeId', nodeId)
    }

    router.replace(`/dependencies?${params.toString()}`, { scroll: false })
  }

  const handleNodeClick = (node: D3Node) => {
    setSelectedNode(node)
  }

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
        </div>

        {/* Project Selection */}
        {viewMode === 'project' && (
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Node ID
              </label>
              <NodeIdInput
                value={nodeId}
                onValueChange={handleNodeIdChange}
                placeholder="Enter node ID..."
              />
            </div>
          </div>
        )}
      </div>

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
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
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
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <GitBranch className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Graph Loaded</h3>
              <p className="text-gray-600">
                {viewMode === 'project'
                  ? 'Select a project to visualize its dependencies'
                  : 'Enter a node ID to visualize its dependency graph'
                }
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