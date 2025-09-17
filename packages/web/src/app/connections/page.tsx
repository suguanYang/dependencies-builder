'use client'

import React, { useState } from 'react'
import useSWR, { SWRConfig } from 'swr'
import { PlusIcon, TrashIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HomeIcon } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircleIcon } from 'lucide-react'
import { swrConfig } from '@/lib/swr-config'
import { type Connection, type Node, getConnectionsList, deleteConnection, createConnection, getNodesByIds } from '@/lib/api'

function ConnectionsContent() {
  const [error, setError] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [searchFilters, setSearchFilters] = useState({
    fromId: '',
    toId: ''
  })
  const [newConnection, setNewConnection] = useState({
    fromId: '',
    toId: ''
  })

  const { data: connectionsResponse, isLoading, mutate: mutateConnections } = useSWR(
    ['connections', searchFilters],
    () => getConnectionsList({
      fromId: searchFilters.fromId || undefined,
      toId: searchFilters.toId || undefined,
      limit: 100
    })
  )

  const connections = connectionsResponse?.data || []

  // Extract all unique node IDs from connections for validation
  const allNodeIds = React.useMemo(() => {
    const ids = new Set<string>()
    connections.forEach((connection: Connection) => {
      ids.add(connection.fromId)
      ids.add(connection.toId)
    })
    return Array.from(ids)
  }, [connections])

  // Batch query for node validation
  const { data: batchNodesResponse } = useSWR(
    allNodeIds.length > 0 ? ['nodes-batch', allNodeIds] : null,
    () => getNodesByIds(allNodeIds)
  )

  const validatedNodes = batchNodesResponse?.data || []

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

  const handleSearch = () => {
    // Search is handled by the SWR key change
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Connections Management</h1>
            <p className="text-gray-600 mt-2">Manage all dependency connections in the system</p>
          </div>
          <Link href="/">
            <Button variant="outline">
              <HomeIcon className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <div className="mb-6 bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-4">Search Connections</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">From Node ID</label>
            <Input
              placeholder="Enter from node ID"
              value={searchFilters.fromId}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, fromId: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">To Node ID</label>
            <Input
              placeholder="Enter to node ID"
              value={searchFilters.toId}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, toId: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleSearch} className="w-full">
              <SearchIcon className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Connections ({connections.length})</h2>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

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
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From Node</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To Node</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {connections.map((connection: Connection) => (
                <tr key={connection.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{connection.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {connection.fromId}
                    {validatedNodes.find((n: Node) => n.id === connection.fromId) && (
                      <span className="ml-2 text-xs text-green-600">✓</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {connection.toId}
                    {validatedNodes.find((n: Node) => n.id === connection.toId) && (
                      <span className="ml-2 text-xs text-green-600">✓</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {connection.createdAt ? new Date(connection.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(connection.id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
      <ConnectionsContent />
    </SWRConfig>
  )
}