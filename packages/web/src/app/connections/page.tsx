'use client'

import React, { useState, Suspense, useEffect } from 'react'
import useSWR, { SWRConfig } from 'swr'
import { PlusIcon, TrashIcon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { AlertCircleIcon } from 'lucide-react'
import { swrConfig } from '@/lib/swr-config'
import {
  type Connection,
  getConnectionsList,
  deleteConnection,
  createConnection,
  createAction,
  NodeType,
  getActionById,
} from '@/lib/api'
import { VirtualTable } from '@/components/virtual-table'
import { useRouter, useSearchParams } from 'next/navigation'
import useDebounce from '@/hooks/use-debounce-value'

function ConnectionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [isAutoCreating, setIsAutoCreating] = useState(false)
  const [currentActionId, setCurrentActionId] = useState<string | null>(null)

  // Get pagination from URL query parameters
  const currentPage = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')
  const [searchFilters, setSearchFilters] = useState({
    fromId: '',
    toId: '',
    fromNodeName: '',
    toNodeName: '',
    fromNodeProjectName: '',
    toNodeProjectName: '',
    fromNodeType: '',
    toNodeType: '',
  })
  const [newConnection, setNewConnection] = useState({
    fromId: '',
    toId: '',
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
    router.push(`?${params.toString()}`)
  }

  const handlePageChange = (page: number) => {
    updatePaginationParams(page, pageSize)
  }

  const handlePageSizeChange = (size: number) => {
    updatePaginationParams(1, size) // Reset to first page when changing page size
  }

  const {
    data: connectionsResponse,
    isLoading,
    mutate: mutateConnections,
  } = useSWR(['connections', debouncedSearchFilters, currentPage, pageSize], () =>
    getConnectionsList({
      fromId: debouncedSearchFilters.fromId || undefined,
      toId: debouncedSearchFilters.toId || undefined,
      fromNodeName: debouncedSearchFilters.fromNodeName || undefined,
      toNodeName: debouncedSearchFilters.toNodeName || undefined,
      fromNodeProjectName: debouncedSearchFilters.fromNodeProjectName || undefined,
      toNodeProjectName: debouncedSearchFilters.toNodeProjectName || undefined,
      fromNodeType: debouncedSearchFilters.fromNodeType || undefined,
      toNodeType: debouncedSearchFilters.toNodeType || undefined,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    }),
  )

  // Use SWR to poll action status when an action is running
  const { data: currentAction } = useSWR(
    currentActionId ? ['action', currentActionId] : null,
    () => getActionById(currentActionId!),
    {
      refreshInterval: currentActionId ? 2000 : 0, // Poll every 2 seconds if action is running
      revalidateOnFocus: false,
      onSuccess: (action) => {
        // If action is completed or failed, stop polling and refresh connections
        if (action.status === 'completed' || action.status === 'failed') {
          setCurrentActionId(null)
          mutateConnections() // Refresh connections list

          if (action.status === 'completed') {
            const result = action.result
            if (result) {
              setSuccess(
                `Auto-creation completed: ${result.createdConnections} connections created, ${result.skippedConnections} skipped`,
              )
            } else {
              setSuccess('Connection auto-creation completed successfully')
            }
          } else if (action.status === 'failed') {
            setError(`Auto-creation failed: ${action.error || 'Unknown error'}`)
          }
        }
      },
      onError: (err) => {
        console.error('Failed to poll action status:', err)
      },
    },
  )

  const connections = connectionsResponse?.data || []
  const totalCount = connectionsResponse?.total || 0

  const handleDelete = async (connectionId: string) => {
    try {
      await deleteConnection(connectionId)
      mutateConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection')
    }
  }

  const handleCreate = async () => {
    try {
      await createConnection(newConnection)
      setIsCreating(false)
      setNewConnection({ fromId: '', toId: '' })
      mutateConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create connection')
    }
  }

  const handleAutoCreate = async () => {
    try {
      setIsAutoCreating(true)
      setError('')
      setSuccess('')

      // Trigger async connection auto-creation
      const action = await createAction({
        type: 'connection_auto_create',
      })
      setCurrentActionId(action.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger connection auto-creation')
    } finally {
      setIsAutoCreating(false)
    }
  }

  return (
    <div className="pt-6 px-6">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <AlertCircleIcon className="h-4 w-4 text-red-600 mr-2" />
            <span className="text-sm text-red-800">{error}</span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto text-xs px-2 py-1 h-6"
              onClick={() => setError('')}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <AlertCircleIcon className="h-4 w-4 text-green-600 mr-2" />
            <span className="text-sm text-green-800">{success}</span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto text-xs px-2 py-1 h-6"
              onClick={() => setSuccess('')}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Action Status Indicator */}
      {currentAction && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center">
            <RefreshCwIcon
              className={`h-4 w-4 text-blue-600 mr-2 ${currentAction.status === 'running' ? 'animate-spin' : ''}`}
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-800">
                {(currentAction.status === 'running' || currentAction.status === 'pending')
                  ? 'Auto-creation in progress...'
                  : currentAction.status === 'completed'
                    ? 'Auto-creation completed'
                    : 'Auto-creation failed'}
              </div>
              <div className="text-sm text-blue-700">
                {currentAction.status === 'running' && 'Processing connections in background...'}
                {currentAction.status === 'completed' && currentAction.result && (
                  <span>
                    Created {currentAction.result.createdConnections} connections, skipped{' '}
                    {currentAction.result.skippedConnections} duplicates
                    {currentAction.result.errors && currentAction.result.errors.length > 0 && (
                      <span className="text-yellow-600">
                        {' '}
                        (with {currentAction.result.errors.length} errors)
                      </span>
                    )}
                  </span>
                )}
                {currentAction.status === 'failed' && (
                  <span>Error: {currentAction.error || 'Unknown error'}</span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs px-2 py-1 h-6"
              onClick={() => setCurrentActionId(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-6 h-full">
        {/* Left side - Filters */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white p-4 rounded-lg shadow-sm border sticky top-6 h-fit">
            <h2 className="text-lg font-semibold mb-4">Filters</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">From Node ID</label>
                <Input
                  placeholder="Partial match from node ID"
                  value={searchFilters.fromId}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({ ...prev, fromId: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">To Node ID</label>
                <Input
                  placeholder="Partial match to node ID"
                  value={searchFilters.toId}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({ ...prev, toId: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">From Node Name</label>
                <Input
                  placeholder="Partial match from node name"
                  value={searchFilters.fromNodeName || ''}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({ ...prev, fromNodeName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">From Node Project</label>
                <Input
                  placeholder="Partial match from node project"
                  value={searchFilters.fromNodeProjectName || ''}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({ ...prev, fromNodeProjectName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">From Node Type</label>
                <select
                  value={searchFilters.fromNodeType || ''}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({ ...prev, fromNodeType: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">All Types</option>
                  <option value={NodeType.NamedExport}>NamedExport</option>
                  <option value={NodeType.NamedImport}>NamedImport</option>
                  <option value={NodeType.RuntimeDynamicImport}>RuntimeDynamicImport</option>
                  <option value={NodeType.GlobalVarRead}>GlobalVarRead</option>
                  <option value={NodeType.GlobalVarWrite}>GlobalVarWrite</option>
                  <option value={NodeType.WebStorageRead}>WebStorageRead</option>
                  <option value={NodeType.WebStorageWrite}>WebStorageWrite</option>
                  <option value={NodeType.EventOn}>EventOn</option>
                  <option value={NodeType.EventEmit}>EventEmit</option>
                  <option value={NodeType.DynamicModuleFederationReference}>
                    DynamicModuleFederationReference
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">To Node Name</label>
                <Input
                  placeholder="Partial match to node name"
                  value={searchFilters.toNodeName || ''}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({ ...prev, toNodeName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">To Node Project</label>
                <Input
                  placeholder="Partial match to node project"
                  value={searchFilters.toNodeProjectName || ''}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({ ...prev, toNodeProjectName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">To Node Type</label>
                <select
                  value={searchFilters.toNodeType || ''}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({ ...prev, toNodeType: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">All Types</option>
                  <option value={NodeType.NamedExport}>NamedExport</option>
                  <option value={NodeType.NamedImport}>NamedImport</option>
                  <option value={NodeType.RuntimeDynamicImport}>RuntimeDynamicImport</option>
                  <option value={NodeType.GlobalVarRead}>GlobalVarRead</option>
                  <option value={NodeType.GlobalVarWrite}>GlobalVarWrite</option>
                  <option value={NodeType.WebStorageRead}>WebStorageRead</option>
                  <option value={NodeType.WebStorageWrite}>WebStorageWrite</option>
                  <option value={NodeType.EventOn}>EventOn</option>
                  <option value={NodeType.EventEmit}>EventEmit</option>
                  <option value={NodeType.DynamicModuleFederationReference}>
                    DynamicModuleFederationReference
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Table */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="mb-6 flex justify-between items-center flex-shrink-0">
            <div>
              <h2 className="text-xl font-semibold">Connections ({connections.length})</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <Button onClick={handleAutoCreate} disabled={isAutoCreating} variant="outline">
                  <RefreshCwIcon
                    className={`h-4 w-4 mr-2 ${isAutoCreating ? 'animate-spin' : ''}`}
                  />
                  {isAutoCreating ? 'Auto-creating...' : 'Auto-create Connections'}
                </Button>
                <Button onClick={() => setIsCreating(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Connection
                </Button>
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading connections...</p>
            </div>
          )}

          {!isLoading && connections.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No connections found.</p>
            </div>
          )}

          {!isLoading && connections.length > 0 && (
            <VirtualTable
              items={connections}
              height={pageSize >= 20 ? '70vh' : '640px'}
              itemHeight={64}
              columns={[
                // { key: 'id', header: 'ID', width: 200 },
                {
                  key: 'fromNode',
                  header: 'From Node',
                  width: '300',
                  render: (connection: Connection) => (
                    <div className="space-y-1 min-w-0">
                      <div className="font-medium truncate">
                        {connection.fromNode ? (
                          <Link
                            href={`/node-detail?id=${connection.fromNode.id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline truncate block"
                          >
                            {connection.fromNode.name}
                          </Link>
                        ) : (
                          'Unknown'
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {connection.fromNode?.projectName} • {connection.fromNode?.type}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'toNode',
                  header: 'To Node',
                  width: '300',
                  render: (connection: Connection) => (
                    <div className="space-y-1 min-w-0">
                      <div className="font-medium truncate">
                        {connection.toNode ? (
                          <Link
                            href={`/node-detail?id=${connection.toNode.id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline truncate block"
                          >
                            {connection.toNode.name}
                          </Link>
                        ) : (
                          'Unknown'
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {connection.toNode?.projectName} • {connection.toNode?.type}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'createdAt',
                  header: 'Created',
                  width: '160',
                  render: (connection: Connection) => (
                    <div className="text-sm truncate">
                      {connection.createdAt
                        ? new Date(connection.createdAt).toLocaleString()
                        : 'N/A'}
                    </div>
                  ),
                },
              ]}
              actions={(connection: Connection) => (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(connection.id)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              )}
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

      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Connection</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">From Node ID</label>
                <Input
                  value={newConnection.fromId}
                  onChange={(e) =>
                    setNewConnection((prev) => ({ ...prev, fromId: e.target.value }))
                  }
                  placeholder="From node ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">To Node ID</label>
                <Input
                  value={newConnection.toId}
                  onChange={(e) => setNewConnection((prev) => ({ ...prev, toId: e.target.value }))}
                  placeholder="To node ID"
                />
              </div>

              <div className="flex space-x-4">
                <Button onClick={handleCreate} className="flex-1">
                  Create
                </Button>
                <Button variant="outline" onClick={() => setIsCreating(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ConnectionsPage() {
  return (
    <SWRConfig value={swrConfig}>
      <Suspense
        fallback={<div className="min-h-screen bg-gray-50 p-6">Loading connections...</div>}
      >
        <ConnectionsContent />
      </Suspense>
    </SWRConfig>
  )
}
