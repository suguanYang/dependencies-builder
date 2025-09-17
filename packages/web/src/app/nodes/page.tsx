'use client'

import React, { useState } from 'react'
import useSWR, { SWRConfig, useSWRConfig } from 'swr'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HomeIcon } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircleIcon } from 'lucide-react'
import { swrConfig } from '@/lib/swr-config'
import { type Node } from '@/lib/api'

function NodesContent() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [error, setError] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const { mutate: globalMutate } = useSWRConfig()
  const [newNode, setNewNode] = useState({
    project: '',
    branch: '',
    type: '',
    name: '',
    relativePath: '',
    startLine: 0,
    startColumn: 0,
    version: '1.0.0',
    meta: {}
  })

  const { data: nodesData, error: nodesError, isLoading, mutate } = useSWR(
    '/nodes?limit=100'
  )

  React.useEffect(() => {
    if (nodesData) {
      setNodes(nodesData.data || nodesData)
    }
  }, [nodesData])

  React.useEffect(() => {
    if (nodesError) {
      setError(nodesError.message)
    }
  }, [nodesError])

  const handleDelete = async (nodeId: string) => {
    try {
      const response = await fetch(`/api/nodes/${nodeId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete node')
      }
      
      globalMutate('/nodes?limit=100')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete node')
    }
  }

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newNode)
      })
      
      if (!response.ok) {
        throw new Error('Failed to create node')
      }
      
      setIsCreating(false)
      setNewNode({
        project: '',
        branch: '',
        type: '',
        name: '',
        relativePath: '',
        startLine: 0,
        startColumn: 0,
        version: '1.0.0',
        meta: {}
      })
      globalMutate('/nodes?limit=100')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create node')
    }
  }


  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nodes Management</h1>
            <p className="text-gray-600 mt-2">Manage all nodes in the system</p>
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
          <h2 className="text-xl font-semibold">All Nodes ({nodes.length})</h2>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Node
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
          <p className="text-gray-500">Loading nodes...</p>
        </div>
      )}

      {!isLoading && nodes.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No nodes found.</p>
        </div>
      )}

      {!isLoading && nodes.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {nodes.map((node) => (
                <tr key={node.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{node.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{node.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{node.project}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{node.type}</td>
                  <td className="px-6 py-4 text-sm">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(node.id)}
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
            <h3 className="text-lg font-semibold mb-4">Create New Node</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Project</label>
                <Input
                  value={newNode.project}
                  onChange={(e) => setNewNode(prev => ({ ...prev, project: e.target.value }))}
                  placeholder="Project name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Branch</label>
                <Input
                  value={newNode.branch}
                  onChange={(e) => setNewNode(prev => ({ ...prev, branch: e.target.value }))}
                  placeholder="Branch name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  value={newNode.type}
                  onChange={(e) => setNewNode(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select type</option>
                  <option value="NamedExport">NamedExport</option>
                  <option value="NamedImport">NamedImport</option>
                  <option value="RuntimeDynamicImport">RuntimeDynamicImport</option>
                  <option value="Externals">Externals</option>
                  <option value="GlobalState">GlobalState</option>
                  <option value="EventOn">EventOn</option>
                  <option value="EventEmit">EventEmit</option>
                  <option value="DynamicModuleFederationReference">DynamicModuleFederationReference</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <Input
                  value={newNode.name}
                  onChange={(e) => setNewNode(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Node name"
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

export default function NodesPage() {
  return (
    <SWRConfig value={swrConfig}>
      <NodesContent />
    </SWRConfig>
  )
}