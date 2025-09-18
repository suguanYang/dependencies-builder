'use client'

import React, { useState } from 'react'
import useSWR, { SWRConfig } from 'swr'
import { PlusIcon, TrashIcon, RefreshCwIcon, PlayIcon, EyeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HomeIcon } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircleIcon } from 'lucide-react'
import { swrConfig } from '@/lib/swr-config'
import { type Action, type CreateActionData, getActions, deleteAction, createAction, getActionResult } from '@/lib/api'

function ActionsContent() {
  const [error, setError] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [viewingResult, setViewingResult] = useState<{ actionId: string; result: any } | null>(null)
  const [newAction, setNewAction] = useState<CreateActionData>({
    project: '',
    branch: '',
    type: 'static_analysis'
  })

  const { data: actionsResponse, isLoading, mutate: mutateActions } = useSWR(
    'actions',
    () => getActions()
  )

  const actions = actionsResponse?.data || []

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
      setNewAction({
        project: '',
        branch: '',
        type: 'static_analysis'
      })
      mutateActions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create action')
    }
  }

  const handleViewResult = async (actionId: string) => {
    try {
      const result = await getActionResult(actionId)
      setViewingResult({ actionId, result })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch action result')
    }
  }

  const getStatusColor = (status: Action['status']) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'running': return 'text-blue-600 bg-blue-100'
      case 'completed': return 'text-green-600 bg-green-100'
      case 'failed': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Actions Management</h1>
            <p className="text-gray-600 mt-2">Create and manage static analysis actions</p>
          </div>
          <Link href="/">
            <Button variant="outline">
              <HomeIcon className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">All Actions ({actions.length})</h2>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => mutateActions()} variant="outline">
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreating(true)}>
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
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2" 
              onClick={() => setError('')}
            >
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
          <p className="text-gray-500">No actions found. Create your first action to get started.</p>
        </div>
      )}

      {!isLoading && actions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {actions.map((action: Action) => (
                <tr key={action.id}>
                  <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                    {action.id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{action.project}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{action.branch}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <span className="capitalize">{action.type.replace('_', ' ')}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(action.status)}`}>
                      {action.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(action.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex space-x-2">
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
                <Input
                  value={newAction.project}
                  onChange={(e) => setNewAction(prev => ({ ...prev, project: e.target.value }))}
                  placeholder="Project name (e.g., https://gitlab.com/user/repo.git)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Branch</label>
                <Input
                  value={newAction.branch}
                  onChange={(e) => setNewAction(prev => ({ ...prev, branch: e.target.value }))}
                  placeholder="Branch name (e.g., main, develop)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Action Type</label>
                <select
                  value={newAction.type}
                  onChange={(e) => setNewAction(prev => ({ ...prev, type: e.target.value as CreateActionData['type'] }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="static_analysis">Static Analysis</option>
                  <option value="dependency_check">Dependency Check</option>
                  <option value="validation">Validation</option>
                </select>
              </div>
              
              <div className="flex space-x-4">
                <Button onClick={handleCreate} className="flex-1">
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Create & Run
                </Button>
                <Button variant="outline" onClick={() => setIsCreating(false)} className="flex-1">
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
              <h4 className="font-medium mb-2">Action ID: {viewingResult.actionId}</h4>
              <pre className="text-sm overflow-auto bg-white p-4 rounded border">
                {JSON.stringify(viewingResult.result, null, 2)}
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