'use client'

import React, { useState, Suspense } from 'react'
import useSWR, { SWRConfig, mutate } from 'swr'
import { PlusIcon, TrashIcon, EditIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const [searchFilters, setSearchFilters] = useState({
    projectName: '',
    branch: '',
    type: '',
    name: '',
    standalone: false,
  })

  // Get pagination from URL query parameters
  const currentPage = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')
  const standaloneParam = searchParams.get('standalone') === 'true'

  // Initialize search filters with URL parameters
  React.useEffect(() => {
    if (standaloneParam && !searchFilters.standalone) {
      setSearchFilters((prev) => ({ ...prev, standalone: true }))
    }
  }, [standaloneParam, searchFilters.standalone])

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
    projectName: '',
    branch: '',
    type: NodeType.NamedExport,
    name: '',
    relativePath: '',
    startLine: 0,
    startColumn: 0,
    endLine: 0,
    endColumn: 0,
    version: '1.0.0',
    meta: {},
  })

  // Fetch nodes with server-side filtering
  const { data: nodesResponse, isLoading } = useSWR(
    ['nodes', searchFilters, currentPage, pageSize],
    () =>
      getNodes({
        projectName: searchFilters.projectName || undefined,
        branch: searchFilters.branch || undefined,
        type: (searchFilters.type as NodeType) || undefined,
        name: searchFilters.name || undefined,
        standalone: searchFilters.standalone || undefined,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      }),
  )

  const nodes = nodesResponse?.data || []
  const totalCount = nodesResponse?.total || 0

  const handleDelete = async (nodeId: string) => {
    try {
      await deleteNode(nodeId)
      // Refresh the nodes data
      mutate(['nodes', searchFilters, currentPage, pageSize])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete node')
    }
  }

  const handleCreate = async () => {
    try {
      await createNode(newNode)
      setNewNode({
        projectName: '',
        branch: '',
        type: NodeType.NamedExport,
        name: '',
        relativePath: '',
        startLine: 0,
        startColumn: 0,
        endLine: 0,
        endColumn: 0,
        version: '1.0.0',
        meta: {},
      })
      // Refresh the nodes data
      mutate(['nodes', searchFilters, currentPage, pageSize])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create node')
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingNode) return
    try {
      await updateNode(editingNode.id, {
        projectName: editingNode.projectName,
        branch: editingNode.branch,
        type: editingNode.type,
        name: editingNode.name,
        relativePath: editingNode.relativePath,
        startLine: editingNode.startLine,
        startColumn: editingNode.startColumn,
        endLine: editingNode.endLine,
        endColumn: editingNode.endColumn,
        version: editingNode.version,
        meta: editingNode.meta,
      })
      // Refresh the nodes data
      mutate(['nodes', searchFilters, currentPage, pageSize])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update node')
    } finally {
      setEditingNode(null)
    }
  }

  return (
    <div className="pt-6 px-6">
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-6 h-full">
        {/* Left side - Filters */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white p-4 rounded-lg shadow-sm border sticky top-6 h-fit">
            <h2 className="text-lg font-semibold mb-4">Filters</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Project Name</label>
                <Input
                  placeholder="Partial match project"
                  value={searchFilters.projectName}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({ ...prev, projectName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Branch</label>
                <Input
                  placeholder="Partial match branch"
                  value={searchFilters.branch}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({ ...prev, branch: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  value={searchFilters.type}
                  onChange={(e) => setSearchFilters((prev) => ({ ...prev, type: e.target.value }))}
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
                <label className="block text-sm font-medium mb-2">Name</label>
                <Input
                  placeholder="Partial match name"
                  value={searchFilters.name}
                  onChange={(e) => setSearchFilters((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="standalone"
                  checked={searchFilters.standalone}
                  onChange={(e) =>
                    setSearchFilters((prev) => ({ ...prev, standalone: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="standalone" className="text-sm font-medium">
                  Show only standalone nodes
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Table */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="mb-6 flex justify-between items-center flex-shrink-0">
            <div>
              <h2 className="text-xl font-semibold">All Nodes ({nodes.length})</h2>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={() => setIsCreating(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Node
              </Button>
            </div>
          </div>

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
              height={pageSize >= 20 ? '70vh' : '640px'}
              itemHeight={64}
              columns={[
                // { key: 'id', header: 'ID', width: 200 },
                {
                  key: 'name',
                  header: 'Name',
                  width: '400',
                  render: (node: Node) => (
                    <Link
                      href={`/node-detail?id=${node.id}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline truncate block"
                    >
                      {node.name}
                    </Link>
                  ),
                },
                {
                  key: 'projectName',
                  header: 'Project',
                  width: '140',
                  render: (node: Node) => <div className="truncate">{node.projectName}</div>,
                },
                {
                  key: 'type',
                  header: 'Type',
                  width: 160,
                  render: (node: Node) => <div className="text-sm">{node.type}</div>,
                },
              ]}
              actions={(node) => (
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingNode(node)}>
                    <EditIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(node.id)}>
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
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
            <h3 className="text-lg font-semibold mb-4">Create New Node</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Project</label>
                <Input
                  value={newNode.projectName}
                  onChange={(e) => setNewNode((prev) => ({ ...prev, projectName: e.target.value }))}
                  placeholder="Project name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Branch</label>
                <Input
                  value={newNode.branch}
                  onChange={(e) => setNewNode((prev) => ({ ...prev, branch: e.target.value }))}
                  placeholder="Branch name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  value={newNode.type}
                  onChange={(e) =>
                    setNewNode((prev) => ({ ...prev, type: e.target.value as NodeType }))
                  }
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
                  <option value={NodeType.DynamicModuleFederationReference}>
                    DynamicModuleFederationReference
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <Input
                  value={newNode.name}
                  onChange={(e) => setNewNode((prev) => ({ ...prev, name: e.target.value }))}
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
                  value={editingNode.projectName}
                  onChange={(e) =>
                    setEditingNode((prev) =>
                      prev ? { ...prev, projectName: e.target.value } : null,
                    )
                  }
                  placeholder="Project name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Branch</label>
                <Input
                  value={editingNode.branch}
                  onChange={(e) =>
                    setEditingNode((prev) => (prev ? { ...prev, branch: e.target.value } : null))
                  }
                  placeholder="Branch name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  value={editingNode.type}
                  onChange={(e) =>
                    setEditingNode((prev) =>
                      prev ? { ...prev, type: e.target.value as NodeType } : null,
                    )
                  }
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
                  <option value={NodeType.DynamicModuleFederationReference}>
                    DynamicModuleFederationReference
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <Input
                  value={editingNode.name}
                  onChange={(e) =>
                    setEditingNode((prev) => (prev ? { ...prev, name: e.target.value } : null))
                  }
                  placeholder="Node name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Relative Path</label>
                <Input
                  value={editingNode.relativePath || ''}
                  onChange={(e) =>
                    setEditingNode((prev) =>
                      prev ? { ...prev, relativePath: e.target.value } : null,
                    )
                  }
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
