'use client'

import React, { useState } from 'react'
import useSWR, { SWRConfig } from 'swr'
import {
  PlusIcon,
  TrashIcon,
  RefreshCwIcon,
  PlayIcon,
  EyeIcon,
  SquareIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircleIcon } from 'lucide-react'
import { swrConfig } from '@/lib/swr-config'
import {
  type Action,
  type CreateActionData,
  getActions,
  deleteAction,
  createAction,
  stopActionExecution,
  getActionById,
  type Project,
} from '@/lib/api'
import { ProjectSelector } from '@/components/project-selector'
function ActionsContent() {
  const [error, setError] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [viewingResult, setViewingResult] = useState<{
    actionId: string
    result: {
      actionId: string
      projectName?: string
      projectAddr?: string
      branch?: string
      type: string
      result: any
    }
  } | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project>()
  const [newAction, setNewAction] = useState<CreateActionData>({
    projectAddr: '',
    projectName: '',
    branch: '',
    type: 'static_analysis',
    targetBranch: '',
  })

  const {
    data: actionsResponse,
    isLoading,
    mutate: mutateActions,
  } = useSWR('actions', () => getActions())

  const actions = actionsResponse?.data || []

  // Update newAction when project is selected
  React.useEffect(() => {
    if (selectedProject) {
      setNewAction((prev) => ({
        ...prev,
        projectName: selectedProject.name,
        projectAddr: selectedProject.addr,
      }))
    } else {
      setNewAction((prev) => ({
        ...prev,
        projectName: '',
        projectAddr: '',
      }))
    }
  }, [selectedProject])

  const handleDelete = async (actionId: string) => {
    try {
      await deleteAction(actionId)
      mutateActions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete action')
    }
  }

  const handleCreate = async () => {
    try {
      await createAction(newAction)
      setIsCreating(false)
      setSelectedProject(undefined)
      setNewAction({
        projectAddr: '',
        projectName: '',
        branch: '',
        type: 'static_analysis',
        targetBranch: '',
      })
      mutateActions()
    } catch (err) {
      if (err instanceof Error && err.message.includes('Too many running actions')) {
        setError(
          'Too many running actions. Please wait for some actions to complete before creating new ones.',
        )
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create action')
      }
    }
  }

  const handleViewResult = async (actionId: string) => {
    try {
      const response = await getActionById(actionId)
      const result = {
        actionId,
        projectAddr: response.parameters.projectAddr,
        projectName: response.parameters.projectName,
        branch: response.parameters.branch,
        type: response.type,
        result: response.result,
      }
      setViewingResult({ actionId, result })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch action result')
    }
  }

  const handleStopExecution = async (actionId: string) => {
    try {
      await stopActionExecution(actionId)
      mutateActions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop action execution')
    }
  }

  const handleRetry = async (action: Action) => {
    try {
      // Create new action with same parameters
      const retryData: CreateActionData = {
        type: action.type,
        projectAddr: action.parameters.projectAddr,
        projectName: action.parameters.projectName,
        branch: action.parameters.branch,
        targetBranch: action.parameters.targetBranch,
      }
      await createAction(retryData)
      mutateActions()
    } catch (err) {
      if (err instanceof Error && err.message.includes('Too many running actions')) {
        setError(
          'Too many running actions. Please wait for some actions to complete before retrying.',
        )
      } else {
        setError(err instanceof Error ? err.message : 'Failed to retry action')
      }
    }
  }

  const getStatusColor = (status: Action['status']) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-100'
      case 'running':
        return 'text-blue-600 bg-blue-100'
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="pt-6 px-6">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">All Actions ({actions.length})</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => mutateActions()}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreating(true)} size="sm" className="flex-1 sm:flex-none">
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Action
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" className="ml-2" onClick={() => setError('')}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading actions...</p>
        </div>
      )}

      {!isLoading && actions.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">
            No actions found. Create your first action to get started.
          </p>
        </div>
      )}

      {!isLoading && actions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20 sm:w-24">
                  ID
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] sm:min-w-[200px] max-w-[200px] sm:max-w-[300px]">
                  Project
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20 sm:w-32">
                  Branch
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20 sm:w-24">
                  Type
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 sm:w-28">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28 sm:w-32">
                  Created
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40 sm:w-48">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {actions.map((action: Action) => (
                <tr key={action.id} className="hover:bg-gray-50">
                  <td
                    className="px-3 py-3 text-sm text-gray-900 font-mono truncate"
                    title={action.id}
                  >
                    {action.id.substring(0, 8)}...
                  </td>
                  <td
                    className="px-3 py-3 text-sm text-gray-900 truncate"
                    title={action.parameters.projectName}
                  >
                    {action.parameters.projectName}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900 truncate">
                    {action.parameters.branch}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900">
                    <span className="capitalize">{action.type.replace('_', ' ')}</span>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(action.status)}`}
                    >
                      {action.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900 whitespace-nowrap">
                    {new Date(action.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {action.status === 'running' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleStopExecution(action.id)}
                          title="Stop Execution"
                        >
                          <SquareIcon className="h-4 w-4" />
                        </Button>
                      )}
                      {action.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewResult(action.id)}
                          title="View Result"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                      )}
                      {action.status === 'failed' && action.error && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setError(action.error || 'Unknown error')}
                          title="View Error"
                        >
                          <AlertCircleIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetry(action)}
                        disabled={action.status === 'running'}
                        title="Retry Action"
                      >
                        <RotateCcwIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(action.id)}
                        disabled={action.status === 'running'}
                        title="Delete Action"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Action Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Action</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Project</label>
                <ProjectSelector
                  value={selectedProject}
                  onValueChange={setSelectedProject}
                  placeholder="Select a project..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Branch</label>
                <Input
                  value={newAction.branch}
                  onChange={(e) => setNewAction((prev) => ({ ...prev, branch: e.target.value }))}
                  placeholder="Branch name (e.g., main, develop)"
                />
              </div>

              {newAction.type === 'report' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Target Branch</label>
                  <Input
                    value={newAction.targetBranch}
                    onChange={(e) =>
                      setNewAction((prev) => ({ ...prev, targetBranch: e.target.value }))
                    }
                    placeholder="Target branch for comparison (e.g., main)"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Action Type</label>
                <select
                  value={newAction.type}
                  onChange={(e) =>
                    setNewAction((prev) => ({
                      ...prev,
                      type: e.target.value as CreateActionData['type'],
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="static_analysis">Analysis</option>
                  <option value="report">Report</option>
                </select>
              </div>

              <div className="flex space-x-4">
                <Button onClick={handleCreate} className="flex-1">
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Create & Run
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false)
                    setSelectedProject(undefined)
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Result Modal */}
      {viewingResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Action Result</h3>
              <Button variant="outline" onClick={() => setViewingResult(null)}>
                Close
              </Button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="mb-4">
                <h4 className="font-medium">Action Details</h4>
                <p className="text-sm text-gray-600">ID: {viewingResult.result.actionId}</p>
                <p className="text-sm text-gray-600">
                  ProjectName: {viewingResult.result.projectName}
                </p>
                <p className="text-sm text-gray-600">
                  ProjectAddr: {viewingResult.result.projectAddr}
                </p>
                <p className="text-sm text-gray-600">Branch: {viewingResult.result.branch}</p>
                <p className="text-sm text-gray-600">Type: {viewingResult.result.type}</p>
              </div>
              <h4 className="font-medium mb-2">Result Data</h4>
              <pre className="text-sm overflow-auto bg-white p-4 rounded border">
                {JSON.stringify(viewingResult.result.result, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ActionsPage() {
  return (
    <SWRConfig value={swrConfig}>
      <ActionsContent />
    </SWRConfig>
  )
}
