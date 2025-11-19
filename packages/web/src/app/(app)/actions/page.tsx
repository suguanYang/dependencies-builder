'use client'

import React, { useState, useEffect, Suspense } from 'react'
import useSWR, { SWRConfig, mutate } from 'swr'
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
import { VirtualTable } from '@/components/virtual-table'
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
  type ActionFilters,
} from '@/lib/api'
import { ProjectSelector } from '@/components/project-selector'
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import useDebounce from '@/hooks/use-debounce-value'

// Zod schema for Action validation
const actionSchema = z.object({
  projectName: z.string().min(1, 'Project is required'),
  projectAddr: z.string().min(1, 'Project address is required'),
  branch: z.string().min(1, 'Branch is required'),
  type: z.enum(['static_analysis', 'report', 'connection_auto_create']),
  targetBranch: z.string().optional(),
  ignoreCallGraph: z.boolean().optional(),
})

type ActionFormData = z.infer<typeof actionSchema>

function ActionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [error, setError] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [viewingDetail, setViewingResult] = useState<Action | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project>()

  // Get pagination from URL query parameters
  const currentPage = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')

  const [searchFilters, setSearchFilters] = useState<ActionFilters>({
    type: (searchParams.get('type') as ActionFilters['type']) || undefined,
    status: (searchParams.get('status') as ActionFilters['status']) || undefined,
  })

  const [clientFilters, setClientFilters] = useState({
    projectName: searchParams.get('projectName') || '',
    branch: searchParams.get('branch') || '',
  })

  // Use debounced search filters for API calls
  const debouncedSearchFilters = useDebounce(searchFilters, 300)

  // Reset to first page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      handlePageChange(1)
    }
  }, [debouncedSearchFilters])

  // Function to update URL with pagination parameters
  const updatePaginationParams = (page: number, size: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    params.set('pageSize', size.toString())

    // Add filter parameters
    if (debouncedSearchFilters.type) params.set('type', debouncedSearchFilters.type)
    else params.delete('type')

    if (debouncedSearchFilters.status) params.set('status', debouncedSearchFilters.status)
    else params.delete('status')

    if (clientFilters.projectName) params.set('projectName', clientFilters.projectName)
    else params.delete('projectName')

    if (clientFilters.branch) params.set('branch', clientFilters.branch)
    else params.delete('branch')

    router.push(`?${params.toString()}`)
  }

  const handlePageChange = (page: number) => {
    updatePaginationParams(page, pageSize)
  }

  const handlePageSizeChange = (size: number) => {
    updatePaginationParams(1, size) // Reset to first page when changing page size
  }

  // React Hook Form for create action
  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
    formState: { errors: createErrors },
    watch,
    setValue,
    resetField,
  } = useForm<ActionFormData>({
    resolver: zodResolver(actionSchema),
    defaultValues: {
      type: 'static_analysis',
      projectAddr: '',
      projectName: '',
      branch: '',
      targetBranch: '',
      ignoreCallGraph: false,
    },
  })

  // Watch the type field to conditionally show targetBranch
  const actionType = watch('type')

  // Fetch actions with server-side filtering
  const { data: actionsResponse, isLoading } = useSWR(
    ['actions', debouncedSearchFilters, currentPage, pageSize],
    () =>
      getActions({
        type: debouncedSearchFilters.type || undefined,
        status: debouncedSearchFilters.status || undefined,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      }),
    {
      refreshInterval: 5000,
    },
  )

  const actions = actionsResponse?.data || []
  const totalCount = actionsResponse?.total || 0

  // Apply client-side filtering for projectName and branch
  const filteredActions = actions.filter((action: Action) => {
    if (
      clientFilters.projectName &&
      !action.parameters.projectName
        ?.toLowerCase()
        .includes(clientFilters.projectName.toLowerCase())
    ) {
      return false
    }
    if (
      clientFilters.branch &&
      !action.parameters.branch?.toLowerCase().includes(clientFilters.branch.toLowerCase())
    ) {
      return false
    }
    return true
  })

  // Update form values when project is selected
  React.useEffect(() => {
    if (selectedProject) {
      setValue('projectName', selectedProject.name)
      setValue('projectAddr', selectedProject.addr)
    } else {
      setValue('projectName', '')
      setValue('projectAddr', '')
    }
  }, [selectedProject, setValue])

  const handleDelete = async (actionId: string) => {
    try {
      await deleteAction(actionId)
      // Refresh the actions data
      mutate(['actions', debouncedSearchFilters, currentPage, pageSize])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete action')
    }
  }

  const handleCreate = async (data: ActionFormData) => {
    try {
      await createAction(data)
      resetCreateForm()
      setSelectedProject(undefined)
      // Refresh the actions data
      mutate(['actions', debouncedSearchFilters, currentPage, pageSize])
    } catch (err) {
      if (err instanceof Error && err.message.includes('Too many running actions')) {
        setError(
          'Too many running actions. Please wait for some actions to complete before creating new ones.',
        )
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create action')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleViewResult = async (actionId: string) => {
    try {
      const response = await getActionById(actionId)

      setViewingResult({ actionId, detail: response })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch action result')
    }
  }

  const handleStopExecution = async (actionId: string) => {
    try {
      await stopActionExecution(actionId)
      // Refresh the actions data
      mutate(['actions', debouncedSearchFilters, currentPage, pageSize])
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
        ignoreCallGraph: action.parameters.ignoreCallGraph,
      }
      await createAction(retryData)
      // Refresh the actions data
      mutate(['actions', debouncedSearchFilters, currentPage, pageSize])
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
      <div className="flex gap-6 h-full">
        {/* Left side - Filters */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white p-4 rounded-lg shadow-sm border sticky top-6 h-fit">
            <h2 className="text-lg font-semibold mb-4">Filters</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  value={searchFilters.type || ''}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({
                      ...prev,
                      type: e.target.value as ActionFilters['type'],
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">All Types</option>
                  <option value="static_analysis">Analysis</option>
                  <option value="report">Report</option>
                  <option value="connection_auto_create">Auto-create Connections</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={searchFilters.status || ''}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({
                      ...prev,
                      status: e.target.value as ActionFilters['status'],
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Project Name</label>
                <Input
                  placeholder="Partial match project"
                  value={clientFilters.projectName || ''}
                  onChange={(e) =>
                    setClientFilters((prev) => ({ ...prev, projectName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Branch</label>
                <Input
                  placeholder="Partial match branch"
                  value={clientFilters.branch || ''}
                  onChange={(e) =>
                    setClientFilters((prev) => ({ ...prev, branch: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Table */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="mb-6 flex justify-between items-center flex-shrink-0">
            <div>
              <h2 className="text-xl font-semibold">All Actions ({filteredActions.length})</h2>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => mutate(['actions', debouncedSearchFilters, currentPage, pageSize])}
                variant="outline"
                size="sm"
              >
                <RefreshCwIcon className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setIsCreating(true)} size="sm">
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
                {totalCount === 0
                  ? 'No actions found. Create your first action to get started.'
                  : 'No actions match the selected filters.'}
              </p>
            </div>
          )}

          {!isLoading && filteredActions.length > 0 && (
            <VirtualTable
              items={filteredActions}
              height={pageSize >= 20 ? '70vh' : '640px'}
              itemHeight={64}
              columns={[
                {
                  key: 'id',
                  header: 'ID',
                  width: '160',
                  render: (action: Action) => (
                    <div className="font-mono truncate" title={action.id}>
                      {action.id}
                    </div>
                  ),
                },
                {
                  key: 'type',
                  header: 'Type',
                  width: '120',
                  render: (action: Action) => (
                    <span className="capitalize">{action.type.replace('_', ' ')}</span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  width: '100',
                  render: (action: Action) => (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(action.status)}`}
                    >
                      {action.status}
                    </span>
                  ),
                },
                {
                  key: 'project',
                  header: 'Project',
                  width: '100',
                  render: (action: Action) => (
                    <div className="font-mono truncate" title={action.parameters.projectName}>
                      {action.parameters.projectName || '---'}
                    </div>
                  ),
                },
                {
                  key: 'createdAt',
                  header: 'Created',
                  width: '120',
                  render: (action: Action) => (
                    <div className="text-sm text-gray-500 whitespace-nowrap">
                      {new Date(action.createdAt).toLocaleString()}
                    </div>
                  ),
                },
                {
                  key: 'Actions',
                  header: 'Actions',
                  width: '60',
                  render: (action: Action) => (
                    <div className="flex space-x-2">
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
                      {(action.status === 'completed' || action.status === 'failed') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewResult(action.id)}
                          title={action.status === 'completed' ? 'View Result' : 'View Error'}
                        >
                          {action.status === 'completed' ? (
                            <EyeIcon className="h-4 w-4" />
                          ) : (
                            <AlertCircleIcon className="h-4 w-4" />
                          )}
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
                  ),
                },
              ]}
              pagination={{
                pageSize,
                currentPage,
                totalItems: totalCount,
                onPageChange: handlePageChange,
                onPageSizeChange: handlePageSizeChange,
              }}
            />
          )}
        </div>
      </div>

      {/* Create Action Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">Create New Action</h3>

            <form onSubmit={handleCreateSubmit(handleCreate)}>
              <FieldSet>
                <FieldGroup>
                  <Field data-invalid={!!createErrors.projectName}>
                    <FieldLabel htmlFor="create-project">Project</FieldLabel>
                    <ProjectSelector
                      value={selectedProject}
                      onValueChange={(project) => {
                        if (project) {
                          setValue('projectName', project.name)
                        } else {
                          resetField('projectName')
                        }

                        setSelectedProject(project)
                      }}
                      placeholder="Select a project..."
                    />
                    <FieldError>{createErrors.projectName?.message}</FieldError>
                  </Field>

                  <Field data-invalid={!!createErrors.branch}>
                    <FieldLabel htmlFor="create-branch">Branch</FieldLabel>
                    <Controller
                      name="branch"
                      control={createControl}
                      render={({ field }) => (
                        <Input
                          id="create-branch"
                          {...field}
                          placeholder="Branch name (e.g., main, develop)"
                          required
                        />
                      )}
                    />
                    <FieldError>{createErrors.branch?.message}</FieldError>
                  </Field>

                  {actionType === 'report' && (
                    <Field>
                      <FieldLabel htmlFor="create-target-branch">Target Branch</FieldLabel>
                      <Controller
                        name="targetBranch"
                        control={createControl}
                        render={({ field }) => (
                          <Input
                            id="create-target-branch"
                            {...field}
                            placeholder="Target branch for comparison (e.g., main)"
                          />
                        )}
                      />
                    </Field>
                  )}

                  <Field>
                    <FieldLabel htmlFor="create-type">Action Type</FieldLabel>
                    <Controller
                      name="type"
                      control={createControl}
                      render={({ field }) => (
                        <select
                          id="create-type"
                          {...field}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="static_analysis">Analysis</option>
                          <option value="report">Report</option>
                          <option value="connection_auto_create">Auto-create Connections</option>
                        </select>
                      )}
                    />
                  </Field>

                  <Field>
                    <div className="flex items-center space-x-2">
                      <Controller
                        name="ignoreCallGraph"
                        control={createControl}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            id="create-ignore-call-graph"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        )}
                      />
                      <FieldLabel
                        htmlFor="create-ignore-call-graph"
                        className="text-sm font-normal"
                      >
                        Ignore Call Graph
                      </FieldLabel>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Skip call graph generation to speed up analysis (will return empty call graph
                      results)
                    </p>
                  </Field>

                  <div className="flex space-x-4">
                    <Button type="submit" className="flex-1">
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Create & Run
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreating(false)
                        setSelectedProject(undefined)
                        resetCreateForm()
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </FieldGroup>
              </FieldSet>
            </form>
          </div>
        </div>
      )}

      {/* View Result Modal */}
      {viewingDetail && (
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
                <p className="text-sm text-gray-600">ID: {viewingDetail.id}</p>
                <p className="text-sm text-gray-600">
                  ProjectName: {viewingDetail.parameters.projectName}
                </p>
                <p className="text-sm text-gray-600">
                  ProjectAddr: {viewingDetail.parameters.projectAddr}
                </p>
                <p className="text-sm text-gray-600">Branch: {viewingDetail.parameters.branch}</p>
                <p className="text-sm text-gray-600">Type: {viewingDetail.type}</p>
                <p className="text-sm text-gray-600">Status: {viewingDetail.status}</p>
                <p className="text-sm text-gray-600">
                  Duration: {calculateDuration(viewingDetail.createdAt, viewingDetail.updatedAt)}
                </p>
              </div>

              {viewingDetail.error && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2 text-red-600">Error</h4>
                  <pre className="text-sm overflow-auto bg-red-50 p-4 rounded border border-red-200 text-red-700">
                    {viewingDetail.error}
                  </pre>
                </div>
              )}
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
      <Suspense fallback={<div className="min-h-screen bg-gray-50 p-6">Loading actions...</div>}>
        <ActionsContent />
      </Suspense>
    </SWRConfig>
  )
}

// Utility function to calculate duration between two dates
function calculateDuration(createdAt: string, updatedAt: string): string {
  const created = new Date(createdAt)
  const updated = new Date(updatedAt)
  const diffMs = updated.getTime() - created.getTime()

  if (diffMs < 0) return 'Invalid'

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}
