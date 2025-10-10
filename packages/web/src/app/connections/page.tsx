'use client'

import React, { useState, Suspense } from 'react'
import useSWR, { SWRConfig } from 'swr'
import { PlusIcon, TrashIcon, SearchIcon, RefreshCwIcon, ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HomeIcon } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircleIcon } from 'lucide-react'
import { swrConfig } from '@/lib/swr-config'
import { type Connection, getConnectionsList, deleteConnection, createConnection, autoCreateDependencies, NodeType } from '@/lib/api'
import { VirtualTable } from '@/components/virtual-table'
import { useRouter, useSearchParams } from 'next/navigation'

function ConnectionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [isAutoCreating, setIsAutoCreating] = useState(false)

  // Get pagination from URL query parameters
  const currentPage = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')
  const [searchFilters, setSearchFilters] = useState({
    fromId: '',
    toId: '',
    fromNodeName: '',
    toNodeName: '',
    fromNodeProject: '',
    toNodeProject: '',
    fromNodeType: '',
    toNodeType: ''
  })
  const [newConnection, setNewConnection] = useState({
    fromId: '',
    toId: ''
  })

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

  const { data: connectionsResponse, isLoading, mutate: mutateConnections } = useSWR(
    ['connections', searchFilters, currentPage, pageSize],
    () => getConnectionsList({
      fromId: searchFilters.fromId || undefined,
      toId: searchFilters.toId || undefined,
      fromNodeName: searchFilters.fromNodeName || undefined,
      toNodeName: searchFilters.toNodeName || undefined,
      fromNodeProject: searchFilters.fromNodeProject || undefined,
      toNodeProject: searchFilters.toNodeProject || undefined,
      fromNodeType: searchFilters.fromNodeType || undefined,
      toNodeType: searchFilters.toNodeType || undefined,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize
    })
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

      const result = await autoCreateDependencies()

      if (result.success) {
        setSuccess(`Auto-created ${result.createdConnections} connections. ${result.skippedConnections} already existed.`)
        if (result.errors.length > 0) {
          setError(`Some errors occurred: ${result.errors.join(', ')}`)
        }
      } else {
        setError('Failed to auto-create connections')
      }

      mutateConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-create connections')
    } finally {
      setIsAutoCreating(false)
    }
  }

  const handleSearch = () => {
    // Search is handled by the SWR key change
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Fixed Back to Home Button */}
      <Link href="/" className="fixed top-4 right-4 z-50">
        <Button variant="outline" className="shadow-sm">
          <HomeIcon className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </Link>

      <header className="mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Connections Management</h1>
          <p className="text-gray-600 mt-2">Manage all dependency connections in the system</p>
        </div>
      </header>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>
            {success}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-6">
        {/* Left side - Filters */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white p-4 rounded-lg shadow-sm border sticky top-6">
            <h2 className="text-lg font-semibold mb-4">Filters</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">From Node ID</label>
                <Input
                  placeholder="Partial match from node ID"
                  value={searchFilters.fromId}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, fromId: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">To Node ID</label>
                <Input
                  placeholder="Partial match to node ID"
                  value={searchFilters.toId}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, toId: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">From Node Name</label>
                <Input
                  placeholder="Partial match from node name"
                  value={searchFilters.fromNodeName || ''}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, fromNodeName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">From Node Project</label>
                <Input
                  placeholder="Partial match from node project"
                  value={searchFilters.fromNodeProject || ''}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, fromNodeProject: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">From Node Type</label>
                <select
                  value={searchFilters.fromNodeType || ''}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, fromNodeType: e.target.value }))}
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
                  <option value={NodeType.DynamicModuleFederationReference}>DynamicModuleFederationReference</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">To Node Name</label>
                <Input
                  placeholder="Partial match to node name"
                  value={searchFilters.toNodeName || ''}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, toNodeName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">To Node Project</label>
                <Input
                  placeholder="Partial match to node project"
                  value={searchFilters.toNodeProject || ''}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, toNodeProject: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">To Node Type</label>
                <select
                  value={searchFilters.toNodeType || ''}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, toNodeType: e.target.value }))}
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
                  <option value={NodeType.DynamicModuleFederationReference}>DynamicModuleFederationReference</option>
                </select>
              </div>
              <Button onClick={handleSearch} className="w-full">
                <SearchIcon className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </div>

        {/* Right side - Table */}
        <div className="flex-1">

          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Connections ({connections.length})</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Show:</label>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <span className="text-sm text-gray-600">per page</span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAutoCreate}
                  disabled={isAutoCreating}
                  variant="outline"
                >
                  <RefreshCwIcon className={`h-4 w-4 mr-2 ${isAutoCreating ? 'animate-spin' : ''}`} />
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
              height={typeof window !== 'undefined' ? window.innerHeight * 0.7 : 600}
              itemHeight={64}
              columns={[
                { key: 'id', header: 'ID', width: 200 },
                {
                  key: 'fromNode',
                  header: 'From Node',
                  width: 300,
                  render: (connection: Connection) => (
                    <div className="space-y-1">
                      <div className="font-medium">
                        {connection.fromNode ? (
                          <Link href={`/node-detail?id=${connection.fromNode.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                            {connection.fromNode.name}
                          </Link>
                        ) : (
                          'Unknown'
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {connection.fromNode?.project} • {connection.fromNode?.type}
                      </div>
                    </div>
                  )
                },
                {
                  key: 'toNode',
                  header: 'To Node',
                  width: 300,
                  render: (connection: Connection) => (
                    <div className="space-y-1">
                      <div className="font-medium">
                        {connection.toNode ? (
                          <Link href={`/node-detail?id=${connection.toNode.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                            {connection.toNode.name}
                          </Link>
                        ) : (
                          'Unknown'
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {connection.toNode?.project} • {connection.toNode?.type}
                      </div>
                    </div>
                  )
                },
                {
                  key: 'createdAt',
                  header: 'Created At',
                  width: 150,
                  render: (connection: Connection) => (
                    <div>
                      {connection.createdAt ? new Date(connection.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                  )
                }
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
                onPageChange: handlePageChange
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
                  onChange={(e) => setNewConnection(prev => ({ ...prev, fromId: e.target.value }))}
                  placeholder="From node ID"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">To Node ID</label>
                <Input
                  value={newConnection.toId}
                  onChange={(e) => setNewConnection(prev => ({ ...prev, toId: e.target.value }))}
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
      <Suspense fallback={<div className="min-h-screen bg-gray-50 p-6">Loading connections...</div>}>
        <ConnectionsContent />
      </Suspense>
    </SWRConfig>
  )
}