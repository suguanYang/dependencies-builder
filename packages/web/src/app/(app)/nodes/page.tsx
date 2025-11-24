'use client'

import React, { useState, Suspense, useEffect } from 'react'
import useSWR, { SWRConfig, mutate } from 'swr'
import { PlusIcon, TrashIcon, EditIcon, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircleIcon } from 'lucide-react'
import { swrConfig } from '@/lib/swr-config'
import { DeleteConfirmationModal } from '@/components/delete-confirmation-modal'
import {
  type Node,
  NodeType,
  getNodes,
  deleteNode,
  createNode,
  updateNode,
  type Project,
} from '@/lib/api'
import { VirtualTable } from '@/components/virtual-table'
import { useRouter, useSearchParams } from 'next/navigation'
import { ProjectSelector } from '@/components/project-selector'
import useDebounce from '@/hooks/use-debounce-value'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// Zod schema for Node validation
const nodeSchema = z.object({
  projectName: z.string().min(1, 'Project is required'),
  branch: z.string().min(1, 'Branch is required'),
  type: z.enum(NodeType),
  name: z.string().min(1, 'Name is required'),
  relativePath: z.string().min(1, 'Relative path is required'),
  startLine: z.number().min(0, 'Start line must be a positive number'),
  startColumn: z.number().min(0, 'Start column must be a positive number'),
  endLine: z.number().min(0, 'End line must be a positive number'),
  endColumn: z.number().min(0, 'End column must be a positive number'),
  version: z.string().min(1, 'Version is required'),
  qlsVersion: z.string().min(1, 'qlsVersion is required'),
  meta: z.object({}).optional(),
})

type NodeFormData = z.infer<typeof nodeSchema>

function NodesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [error, setError] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingNode, setEditingNode] = useState<Node | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project>()
  const [deletingNode, setDeletingNode] = useState<Node | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // React Hook Form for create node
  const {
    setValue,
    resetField,
    control: createControl,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
    formState: { errors: createErrors },
  } = useForm<NodeFormData>({
    resolver: zodResolver(nodeSchema),
    defaultValues: {
      type: NodeType.NamedExport,
      startLine: 0,
      startColumn: 0,
      endLine: 0,
      endColumn: 0,
      version: 'null',
      qlsVersion: '0.1.0',
      meta: {},
    },
  })

  // React Hook Form for edit node
  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    reset: resetEditForm,
    formState: { errors: editErrors },
  } = useForm<NodeFormData>({
    resolver: zodResolver(nodeSchema) as any,
  })

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

  // Fetch nodes with server-side filtering
  const { data: nodesResponse, isLoading } = useSWR(
    ['nodes', debouncedSearchFilters, currentPage, pageSize],
    () =>
      getNodes({
        projectName: debouncedSearchFilters.projectName || undefined,
        branch: debouncedSearchFilters.branch || undefined,
        type: (debouncedSearchFilters.type as NodeType) || undefined,
        name: debouncedSearchFilters.name || undefined,
        standalone: debouncedSearchFilters.standalone || undefined,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      }),
  )

  const nodes = nodesResponse?.data || []
  const totalCount = nodesResponse?.total || 0

  const handleDelete = async (node: Node) => {
    setDeletingNode(node)
  }

  const confirmDelete = async () => {
    if (!deletingNode) return

    setDeleteLoading(true)
    try {
      await deleteNode(deletingNode.id)
      // Refresh the nodes data
      mutate(['nodes', searchFilters, currentPage, pageSize])
      setDeletingNode(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete node')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleCreate = async (data: NodeFormData) => {
    try {
      await createNode(data)
      resetCreateForm()
      setSelectedProject(undefined)
      // Refresh the nodes data
      mutate(['nodes', searchFilters, currentPage, pageSize])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create node')
    } finally {
      setIsCreating(false)
    }
  }

  // Populate edit form when editingNode changes
  useEffect(() => {
    if (editingNode) {
      resetEditForm(editingNode)
    }
  }, [editingNode, resetEditForm])

  const handleUpdate = async (data: NodeFormData) => {
    if (!editingNode) return

    try {
      await updateNode(editingNode.id, data)
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
                  width: '200',
                  render: (node: Node) => (
                    <div className="flex items-center gap-2">
                      <Link href={`/dependencies?nodeId=${node.id}&mode=node`}>
                        <span title="View dependency graph">
                          <GitBranch className="h-4 w-4 text-gray-500 hover:text-blue-600 cursor-pointer" />
                        </span>
                      </Link>
                      <Link
                        href={`/node-detail?id=${node.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline truncate block"
                      >
                        {node.name}
                      </Link>
                    </div>
                  ),
                },
                {
                  key: 'projectName',
                  header: 'Project',
                  width: '120',
                  render: (node: Node) => <div className="truncate">{node.projectName}</div>,
                },
                {
                  key: 'type',
                  header: 'Type',
                  width: 160,
                  render: (node: Node) => <div className="text-sm">{node.type}</div>,
                },
                {
                  key: 'location',
                  header: 'Location',
                  width: '200',
                  render: (node: Node) => (
                    <div className="text-sm text-gray-500 truncate">
                      {node.relativePath &&
                      node.startLine !== undefined &&
                      node.startColumn !== undefined
                        ? `${node.relativePath}:${node.startLine}:${node.startColumn}`
                        : 'N/A'}
                    </div>
                  ),
                },
                {
                  key: 'createdAt',
                  header: 'Created',
                  width: '160',
                  render: (node: Node) => (
                    <div className="text-sm text-gray-500 truncate">
                      {node.createdAt ? new Date(node.createdAt).toLocaleString() : 'N/A'}
                    </div>
                  ),
                },
              ]}
              actions={(node) => (
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingNode(node)}>
                    <EditIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(node)}>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">Create New Node</h3>

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
                        <Input id="create-branch" {...field} placeholder="Branch name" required />
                      )}
                    />
                    <FieldError>{createErrors.branch?.message}</FieldError>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="create-type">Type</FieldLabel>
                    <Controller
                      name="type"
                      control={createControl}
                      render={({ field }) => (
                        <select
                          id="create-type"
                          {...field}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value={NodeType.NamedExport}>NamedExport</option>
                          <option value={NodeType.NamedImport}>NamedImport</option>
                          <option value={NodeType.RuntimeDynamicImport}>
                            RuntimeDynamicImport
                          </option>
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
                      )}
                    />
                  </Field>

                  <Field data-invalid={!!createErrors.name}>
                    <FieldLabel htmlFor="create-name">Name</FieldLabel>
                    <Controller
                      name="name"
                      control={createControl}
                      render={({ field }) => (
                        <Input id="create-name" {...field} placeholder="Node name" required />
                      )}
                    />
                    <FieldError>{createErrors.name?.message}</FieldError>
                  </Field>

                  <Field data-invalid={!!createErrors.relativePath}>
                    <FieldLabel htmlFor="create-relative-path">Relative Path</FieldLabel>
                    <Controller
                      name="relativePath"
                      control={createControl}
                      render={({ field }) => (
                        <Input
                          id="create-relative-path"
                          {...field}
                          placeholder="Relative path"
                          required
                        />
                      )}
                    />
                    <FieldError>{createErrors.relativePath?.message}</FieldError>
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field data-invalid={!!createErrors.startLine}>
                      <FieldLabel htmlFor="create-start-line">Start Line</FieldLabel>
                      <Controller
                        name="startLine"
                        control={createControl}
                        render={({ field }) => (
                          <Input
                            id="create-start-line"
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            required
                          />
                        )}
                      />
                      <FieldError>{createErrors.startLine?.message}</FieldError>
                    </Field>

                    <Field data-invalid={!!createErrors.startColumn}>
                      <FieldLabel htmlFor="create-start-column">Start Column</FieldLabel>
                      <Controller
                        name="startColumn"
                        control={createControl}
                        render={({ field }) => (
                          <Input
                            id="create-start-column"
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            required
                          />
                        )}
                      />
                      <FieldError>{createErrors.startColumn?.message}</FieldError>
                    </Field>

                    <Field data-invalid={!!createErrors.endLine}>
                      <FieldLabel htmlFor="create-end-line">End Line</FieldLabel>
                      <Controller
                        name="endLine"
                        control={createControl}
                        render={({ field }) => (
                          <Input
                            id="create-end-line"
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            required
                          />
                        )}
                      />
                      <FieldError>{createErrors.endLine?.message}</FieldError>
                    </Field>

                    <Field data-invalid={!!createErrors.endColumn}>
                      <FieldLabel htmlFor="create-end-column">End Column</FieldLabel>
                      <Controller
                        name="endColumn"
                        control={createControl}
                        render={({ field }) => (
                          <Input
                            id="create-end-column"
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            required
                          />
                        )}
                      />
                      <FieldError>{createErrors.endColumn?.message}</FieldError>
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="create-version">Version</FieldLabel>
                    <Controller
                      name="version"
                      control={createControl}
                      render={({ field }) => (
                        <Input id="create-version" {...field} placeholder="null" required />
                      )}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="create-version">QLSVersion</FieldLabel>
                    <Controller
                      name="qlsVersion"
                      control={createControl}
                      render={({ field }) => (
                        <Input id="create-qlsVersion" {...field} placeholder="0.1.0" required />
                      )}
                    />
                  </Field>

                  <div className="flex space-x-4">
                    <Button type="submit" className="flex-1">
                      Create
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreating(false)
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

      {/* Edit Node Modal */}
      {editingNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">Edit Node</h3>

            <form onSubmit={handleEditSubmit(handleUpdate)}>
              <FieldSet>
                <FieldGroup>
                  <Field data-invalid={!!editErrors.projectName}>
                    <FieldLabel htmlFor="edit-project">Project</FieldLabel>
                    <Controller
                      name="projectName"
                      control={editControl}
                      render={({ field }) => (
                        <Input
                          id="edit-project"
                          value={field.value || ''}
                          onChange={(e) => field.onChange({ name: e.target.value })}
                          placeholder="Project name"
                          required
                        />
                      )}
                    />
                    <FieldError>{editErrors.projectName?.message}</FieldError>
                  </Field>

                  <Field data-invalid={!!editErrors.branch}>
                    <FieldLabel htmlFor="edit-branch">Branch</FieldLabel>
                    <Controller
                      name="branch"
                      control={editControl}
                      render={({ field }) => (
                        <Input id="edit-branch" {...field} placeholder="Branch name" required />
                      )}
                    />
                    <FieldError>{editErrors.branch?.message}</FieldError>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="edit-type">Type</FieldLabel>
                    <Controller
                      name="type"
                      control={editControl}
                      render={({ field }) => (
                        <select
                          id="edit-type"
                          {...field}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value={NodeType.NamedExport}>NamedExport</option>
                          <option value={NodeType.NamedImport}>NamedImport</option>
                          <option value={NodeType.RuntimeDynamicImport}>
                            RuntimeDynamicImport
                          </option>
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
                      )}
                    />
                  </Field>

                  <Field data-invalid={!!editErrors.name}>
                    <FieldLabel htmlFor="edit-name">Name</FieldLabel>
                    <Controller
                      name="name"
                      control={editControl}
                      render={({ field }) => (
                        <Input id="edit-name" {...field} placeholder="Node name" required />
                      )}
                    />
                    <FieldError>{editErrors.name?.message}</FieldError>
                  </Field>

                  <Field data-invalid={!!editErrors.relativePath}>
                    <FieldLabel htmlFor="edit-relative-path">Relative Path</FieldLabel>
                    <Controller
                      name="relativePath"
                      control={editControl}
                      render={({ field }) => (
                        <Input
                          id="edit-relative-path"
                          {...field}
                          placeholder="Relative path"
                          required
                        />
                      )}
                    />
                    <FieldError>{editErrors.relativePath?.message}</FieldError>
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field data-invalid={!!editErrors.startLine}>
                      <FieldLabel htmlFor="edit-start-line">Start Line</FieldLabel>
                      <Controller
                        name="startLine"
                        control={editControl}
                        render={({ field }) => (
                          <Input
                            id="edit-start-line"
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            required
                          />
                        )}
                      />
                      <FieldError>{editErrors.startLine?.message}</FieldError>
                    </Field>

                    <Field data-invalid={!!editErrors.startColumn}>
                      <FieldLabel htmlFor="edit-start-column">Start Column</FieldLabel>
                      <Controller
                        name="startColumn"
                        control={editControl}
                        render={({ field }) => (
                          <Input
                            id="edit-start-column"
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            required
                          />
                        )}
                      />
                      <FieldError>{editErrors.startColumn?.message}</FieldError>
                    </Field>

                    <Field data-invalid={!!editErrors.endLine}>
                      <FieldLabel htmlFor="edit-end-line">End Line</FieldLabel>
                      <Controller
                        name="endLine"
                        control={editControl}
                        render={({ field }) => (
                          <Input
                            id="edit-end-line"
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            required
                          />
                        )}
                      />
                      <FieldError>{editErrors.endLine?.message}</FieldError>
                    </Field>

                    <Field data-invalid={!!editErrors.endColumn}>
                      <FieldLabel htmlFor="edit-end-column">End Column</FieldLabel>
                      <Controller
                        name="endColumn"
                        control={editControl}
                        render={({ field }) => (
                          <Input
                            id="edit-end-column"
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            required
                          />
                        )}
                      />
                      <FieldError>{editErrors.endColumn?.message}</FieldError>
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="edit-version">Version</FieldLabel>
                    <Controller
                      name="version"
                      control={editControl}
                      render={({ field }) => (
                        <Input id="edit-version" {...field} placeholder="null" required />
                      )}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="edit-qlsVersion">QLSVersion</FieldLabel>
                    <Controller
                      name="qlsVersion"
                      control={editControl}
                      render={({ field }) => (
                        <Input id="edit-qlsVersion" {...field} placeholder="0.1.0" required />
                      )}
                    />
                  </Field>
                  <div className="flex space-x-4">
                    <Button type="submit" className="flex-1">
                      Update
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingNode(null)}
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationModal
        open={!!deletingNode}
        onOpenChange={() => setDeletingNode(null)}
        title="Confirm Delete"
        description={`Are you sure you want to delete the node "${deletingNode?.name}"? This action cannot be undone.`}
        loading={deleteLoading}
        onConfirm={confirmDelete}
      />
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
