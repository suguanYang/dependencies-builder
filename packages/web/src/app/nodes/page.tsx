'use client'

import React, { useState, useEffect, Suspense } from 'react'
import useSWR, { SWRConfig } from 'swr'
import { PlusIcon, TrashIcon, EditIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HomeIcon } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircleIcon } from 'lucide-react'
import { swrConfig } from '@/lib/swr-config'
import { type Node, NodeType, getNodes, deleteNode, createNode, updateNode } from '@/lib/api'
import { VirtualTable } from '@/components/virtual-table'
import { useRouter, useSearchParams } from 'next/navigation'

function NodesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [error, setError] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingNode, setEditingNode] = useState<Node | null>(null)

  // Get pagination from URL query parameters
  const currentPage = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')

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
  const [newNode, setNewNode] = useState({
    project: '',
    branch: '',
    type: NodeType.NamedExport,
    name: '',
    relativePath: '',
    startLine: 0,
    startColumn: 0,
    version: '1.0.0',
    meta: {}
  })

  const { data: nodesResponse, isLoading, mutate: mutateNodes } = useSWR(
    ['nodes', currentPage, pageSize],
    () => getNodes({
      limit: pageSize,
      offset: (currentPage - 1) * pageSize
    })
  )

  const nodes = nodesResponse?.data || []
  const totalCount = nodesResponse?.total || 0

  const handleDelete = async (nodeId: string) => {
    try {
      await deleteNode(nodeId)
      mutateNodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete node')
    }
  }

  const handleCreate = async () => {
    try {
      await createNode(newNode)
      setIsCreating(false)
      setNewNode({
        project: '',
        branch: '',
        type: NodeType.NamedExport,
        name: '',
        relativePath: '',
        startLine: 0,
        startColumn: 0,
        version: '1.0.0',
        meta: {}
      })
      mutateNodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create node')
    }
  }

  const handleUpdate = async () => {
    if (!editingNode) return
    try {
      await updateNode(editingNode.id, {
        project: editingNode.project,
        branch: editingNode.branch,
        type: editingNode.type,
        name: editingNode.name,
        relativePath: editingNode.relativePath,
        startLine: editingNode.startLine,
        startColumn: editingNode.startColumn,
        version: editingNode.version,
        meta: editingNode.meta
      })
      setEditingNode(null)
      mutateNodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update node')
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
          <Button onClick={() => setIsCreating(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Node
          </Button>
        </div>
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
        <VirtualTable
          items={nodes}
          height={400}
          itemHeight={64}
          columns={[
            { key: 'id', header: 'ID', width: 200 },
            { key: 'name', header: 'Name', width: 300 },
            { key: 'project', header: 'Project', width: 150 },
            { key: 'type', header: 'Type', width: 150 }
          ]}
          actions={(node) => (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingNode(node)}
              >
                <EditIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(node.id)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
          pagination={{
            pageSize,
            currentPage,
            totalItems: totalCount,
            onPageChange: handlePageChange
          }}
        />
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
                  onChange={(e) => setNewNode(prev => ({ ...prev, type: e.target.value as NodeType }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
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

      {/* Edit Node Modal */}
      {editingNode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Node</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Project</label>
                <Input
                  value={editingNode.project}
                  onChange={(e) => setEditingNode(prev => prev ? ({ ...prev, project: e.target.value }) : null)}
                  placeholder="Project name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Branch</label>
                <Input
                  value={editingNode.branch}
                  onChange={(e) => setEditingNode(prev => prev ? ({ ...prev, branch: e.target.value }) : null)}
                  placeholder="Branch name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  value={editingNode.type}
                  onChange={(e) => setEditingNode(prev => prev ? ({ ...prev, type: e.target.value as NodeType }) : null)}
                  className="w-full px-3 py-2 border rounded-md"
                >
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
                <label className="block text-sm font-medium mb-2">Name</label>
                <Input
                  value={editingNode.name}
                  onChange={(e) => setEditingNode(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  placeholder="Node name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Relative Path</label>
                <Input
                  value={editingNode.relativePath || ''}
                  onChange={(e) => setEditingNode(prev => prev ? ({ ...prev, relativePath: e.target.value }) : null)}
                  placeholder="Relative path"
                />
              </div>
              
              <div className="flex space-x-4">
                <Button onClick={handleUpdate} className="flex-1">
                  Update
                </Button>
                <Button variant="outline" onClick={() => setEditingNode(null)} className="flex-1">
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
      <Suspense fallback={<div className="min-h-screen bg-gray-50 p-6">Loading nodes...</div>}>
        <NodesContent />
      </Suspense>
    </SWRConfig>
  )
}