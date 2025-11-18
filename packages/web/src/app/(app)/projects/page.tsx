'use client'

import React, { useState, Suspense, useEffect } from 'react'
import useSWR, { SWRConfig, mutate } from 'swr'
import { PlusIcon, TrashIcon, EditIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircleIcon } from 'lucide-react'
import { swrConfig } from '@/lib/swr-config'
import {
  type Project,
  type ProjectQuery,
  type ProjectEntry,
  AppType,
  getProjects,
  deleteProject,
  createProject,
  updateProject,
} from '@/lib/api'
import { VirtualTable } from '@/components/virtual-table'
import { useRouter, useSearchParams } from 'next/navigation'
import { TooltipProvider } from '@/components/ui/tooltip'
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

// Zod schema for Project validation
const projectEntrySchema = z.object({
  name: z.string().min(1, 'Entry name is required'),
  path: z.string().min(1, 'Entry path is required'),
})

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  addr: z.string().min(1, 'Project address is required'),
  type: z.nativeEnum(AppType),
  entries: z.array(projectEntrySchema).default([]),
})

type ProjectFormData = z.infer<typeof projectSchema>

function ProjectsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [error, setError] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [searchFilters, setSearchFilters] = useState<ProjectQuery>({
    name: '',
    addr: '',
    type: undefined,
  })

  // React Hook Form for create project
  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
    formState: { errors: createErrors },
    setValue: setCreateValue,
    getValues: getCreateValues,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema) as any,
    defaultValues: {
      type: AppType.App,
      entries: [],
    },
  })

  // React Hook Form for edit project
  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    reset: resetEditForm,
    formState: { errors: editErrors },
    setValue: setEditValue,
    getValues: getEditValues,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema) as any,
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

  // Helper function to format entries for display
  const formatEntriesForDisplay = (entries?: ProjectEntry[]): string => {
    if (!entries || entries.length === 0) {
      return 'No entries'
    }
    return `${entries.length} entries`
  }

  // Helper functions for managing entries array in create form
  const addNewEntry = () => {
    const currentEntries = getCreateValues('entries') || []
    setCreateValue('entries', [...currentEntries, { name: '', path: '' }])
  }

  const updateEntry = (index: number, field: 'name' | 'path', value: string) => {
    const currentEntries = getCreateValues('entries') || []
    const updatedEntries = currentEntries.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry,
    )
    setCreateValue('entries', updatedEntries)
  }

  const removeEntry = (index: number) => {
    const currentEntries = getCreateValues('entries') || []
    const updatedEntries = currentEntries.filter((_, i) => i !== index)
    setCreateValue('entries', updatedEntries)
  }

  // Helper functions for managing entries array in edit form
  const addEditingEntry = () => {
    const currentEntries = getEditValues('entries') || []
    setEditValue('entries', [...currentEntries, { name: '', path: '' }])
  }

  const updateEditingEntry = (index: number, field: 'name' | 'path', value: string) => {
    const currentEntries = getEditValues('entries') || []
    const updatedEntries = currentEntries.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry,
    )
    setEditValue('entries', updatedEntries)
  }

  const removeEditingEntry = (index: number) => {
    const currentEntries = getEditValues('entries') || []
    const updatedEntries = currentEntries.filter((_, i) => i !== index)
    setEditValue('entries', updatedEntries)
  }

  // Fetch projects with server-side filtering
  const { data: projectsResponse, isLoading } = useSWR(
    ['projects', searchFilters, currentPage, pageSize],
    () =>
      getProjects({
        name: searchFilters.name || undefined,
        addr: searchFilters.addr || undefined,
        type: searchFilters.type,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      }),
  )

  const projects = projectsResponse?.data || []
  const totalCount = projectsResponse?.total || 0

  const handleDelete = async (projectId: string) => {
    try {
      await deleteProject(projectId)
      // Refresh the projects data
      mutate(['projects', searchFilters, currentPage, pageSize])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    }
  }

  const handleCreate = async (data: ProjectFormData) => {
    // Filter out entries with both empty name and path
    const filteredEntries = (data.entries || []).filter(
      (entry) => entry.name.trim() !== '' || entry.path.trim() !== '',
    )

    try {
      await createProject({
        name: data.name,
        addr: data.addr,
        type: data.type,
        entries: filteredEntries,
      })
      resetCreateForm()
      // Refresh the projects data
      mutate(['projects', searchFilters, currentPage, pageSize])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdate = async (data: ProjectFormData) => {
    if (!editingProject) return

    // Filter out entries with both empty name and path
    const filteredEntries = (data.entries || []).filter(
      (entry) => entry.name.trim() !== '' || entry.path.trim() !== '',
    )

    try {
      await updateProject(editingProject.id, {
        name: data.name,
        addr: data.addr,
        type: data.type,
        entries: filteredEntries,
      })
      // Refresh the projects data
      mutate(['projects', searchFilters, currentPage, pageSize])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project')
    } finally {
      setEditingProject(null)
    }
  }

  // Populate edit form when editingProject changes
  useEffect(() => {
    if (editingProject) {
      resetEditForm({
        name: editingProject.name,
        addr: editingProject.addr,
        type: editingProject.type,
        entries: editingProject.entries || [],
      })
    }
  }, [editingProject, resetEditForm])

  return (
    <TooltipProvider>
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
                    placeholder="Partial match name"
                    value={searchFilters.name}
                    onChange={(e) =>
                      setSearchFilters((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Project Address</label>
                  <Input
                    placeholder="Partial match address"
                    value={searchFilters.addr}
                    onChange={(e) =>
                      setSearchFilters((prev) => ({ ...prev, addr: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Project Type</label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="type"
                        value=""
                        checked={!searchFilters.type}
                        onChange={() => setSearchFilters((prev) => ({ ...prev, type: undefined }))}
                        className="text-blue-600"
                      />
                      <span className="text-sm">All Types</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="type"
                        value={AppType.Lib}
                        checked={searchFilters.type === AppType.Lib}
                        onChange={(e) =>
                          setSearchFilters((prev) => ({ ...prev, type: e.target.value as AppType }))
                        }
                        className="text-blue-600"
                      />
                      <span className="text-sm">Library</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="type"
                        value={AppType.App}
                        checked={searchFilters.type === AppType.App}
                        onChange={(e) =>
                          setSearchFilters((prev) => ({ ...prev, type: e.target.value as AppType }))
                        }
                        className="text-blue-600"
                      />
                      <span className="text-sm">Application</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Table */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="mb-6 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold">All Projects ({projects.length})</h2>
              </div>
              <div className="flex items-center gap-4">
                <Button onClick={() => setIsCreating(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Project
                </Button>
              </div>
            </div>

            {isLoading && (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading projects...</p>
              </div>
            )}

            {!isLoading && projects.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No projects found.</p>
              </div>
            )}

            {!isLoading && projects.length > 0 && (
              <VirtualTable
                items={projects}
                height={pageSize >= 20 ? '70vh' : '640px'}
                itemHeight={64}
                columns={[
                  // { key: 'id', header: 'ID', width: 200 },
                  {
                    key: 'name',
                    header: 'Name',
                    width: '180',
                    render: (project: Project) => (
                      <div className="font-medium text-blue-600 truncate">{project.name}</div>
                    ),
                  },
                  {
                    key: 'type',
                    header: 'Type',
                    width: 100,
                    render: (project: Project) => (
                      <div
                        className={`text-sm font-medium px-2 py-1 rounded-full text-center ${
                          project.type === AppType.Lib
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {project.type}
                      </div>
                    ),
                  },
                  {
                    key: 'addr',
                    header: 'Address',
                    width: '300',
                    render: (project: Project) => (
                      <div className="truncate text-sm text-gray-600">{project.addr}</div>
                    ),
                  },
                  {
                    key: 'createdAt',
                    header: 'Created',
                    width: '160',
                    render: (project: Project) => (
                      <div className="text-sm text-gray-500 truncate">
                        {new Date(project.createdAt).toLocaleString()}
                      </div>
                    ),
                  },
                ]}
                actions={(project) => (
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingProject(project)}>
                      <EditIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(project.id)}
                    >
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

        {/* Create Project Modal */}
        {isCreating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
              <h3 className="text-lg font-semibold mb-4">Create New Project</h3>

              <form onSubmit={handleCreateSubmit(handleCreate)}>
                <FieldSet>
                  <FieldGroup>
                    <div className="grid grid-cols-2 gap-4">
                      <Field data-invalid={!!createErrors.name}>
                        <FieldLabel htmlFor="create-name">Project Name</FieldLabel>
                        <Controller
                          name="name"
                          control={createControl}
                          render={({ field }) => (
                            <Input
                              id="create-name"
                              {...field}
                              placeholder="Project name (must be unique)"
                              required
                            />
                          )}
                        />
                        <FieldError>{createErrors.name?.message}</FieldError>
                      </Field>

                      <Field data-invalid={!!createErrors.addr}>
                        <FieldLabel htmlFor="create-addr">Project Address</FieldLabel>
                        <Controller
                          name="addr"
                          control={createControl}
                          render={({ field }) => (
                            <Input
                              id="create-addr"
                              {...field}
                              placeholder="Project address/path"
                              required
                            />
                          )}
                        />
                        <FieldError>{createErrors.addr?.message}</FieldError>
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel>Project Type</FieldLabel>
                      <Controller
                        name="type"
                        control={createControl}
                        render={({ field }) => (
                          <div className="flex space-x-4">
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="create-type"
                                value={AppType.Lib}
                                checked={field.value === AppType.Lib}
                                onChange={(e) => field.onChange(e.target.value as AppType)}
                                className="text-blue-600"
                              />
                              <span className="text-sm">Library</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="create-type"
                                value={AppType.App}
                                checked={field.value === AppType.App}
                                onChange={(e) => field.onChange(e.target.value as AppType)}
                                className="text-blue-600"
                              />
                              <span className="text-sm">Application</span>
                            </label>
                          </div>
                        )}
                      />
                    </Field>

                    <Field>
                      <div className="flex items-center justify-between mb-2">
                        <FieldLabel>Project Entries</FieldLabel>
                        <Button type="button" variant="outline" size="sm" onClick={addNewEntry}>
                          <PlusIcon className="h-4 w-4 mr-1" />
                          Add Entry
                        </Button>
                      </div>
                      <FieldDescription>
                        Store project entries path for projects that cannot find entries by static
                        analysis
                      </FieldDescription>

                      <Controller
                        name="entries"
                        control={createControl}
                        render={({ field }) => (
                          <div>
                            {field.value && field.value.length === 0 ? (
                              <div className="text-center py-4 border border-dashed border-gray-300 rounded-md">
                                <p className="text-sm text-gray-500">No entries added yet</p>
                              </div>
                            ) : (
                              <div className="space-y-3 max-h-80 overflow-y-auto">
                                {field.value?.map((entry, index) => (
                                  <div
                                    key={index}
                                    className="space-y-2 p-3 border border-gray-200 rounded-md"
                                  >
                                    <div className="flex gap-2 items-center">
                                      <div className="flex-1">
                                        <label className="block text-xs font-medium mb-1 text-gray-600">
                                          Entry Name
                                        </label>
                                        <Input
                                          value={entry.name}
                                          onChange={(e) =>
                                            updateEntry(index, 'name', e.target.value)
                                          }
                                          placeholder="Entry name"
                                          className="w-full"
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <label className="block text-xs font-medium mb-1 text-gray-600">
                                          Entry Path
                                        </label>
                                        <Input
                                          value={entry.path}
                                          onChange={(e) =>
                                            updateEntry(index, 'path', e.target.value)
                                          }
                                          placeholder="/path/to/entry"
                                          className="w-full"
                                        />
                                      </div>
                                      <div className="flex-shrink-0 self-end">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => removeEntry(index)}
                                          className="mt-6"
                                        >
                                          <XIcon className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
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

        {/* Edit Project Modal */}
        {editingProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
              <h3 className="text-lg font-semibold mb-4">Edit Project</h3>

              <form onSubmit={handleEditSubmit(handleUpdate)}>
                <FieldSet>
                  <FieldGroup>
                    <div className="grid grid-cols-2 gap-4">
                      <Field data-invalid={!!editErrors.name}>
                        <FieldLabel htmlFor="edit-name">Project Name</FieldLabel>
                        <Controller
                          name="name"
                          control={editControl}
                          render={({ field }) => (
                            <Input
                              id="edit-name"
                              {...field}
                              placeholder="Project name (must be unique)"
                              required
                            />
                          )}
                        />
                        <FieldError>{editErrors.name?.message}</FieldError>
                      </Field>

                      <Field data-invalid={!!editErrors.addr}>
                        <FieldLabel htmlFor="edit-addr">Project Address</FieldLabel>
                        <Controller
                          name="addr"
                          control={editControl}
                          render={({ field }) => (
                            <Input
                              id="edit-addr"
                              {...field}
                              placeholder="Project address/path"
                              required
                            />
                          )}
                        />
                        <FieldError>{editErrors.addr?.message}</FieldError>
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel>Project Type</FieldLabel>
                      <Controller
                        name="type"
                        control={editControl}
                        render={({ field }) => (
                          <div className="flex space-x-4">
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="edit-type"
                                value={AppType.Lib}
                                checked={field.value === AppType.Lib}
                                onChange={(e) => field.onChange(e.target.value as AppType)}
                                className="text-blue-600"
                              />
                              <span className="text-sm">Library</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="edit-type"
                                value={AppType.App}
                                checked={field.value === AppType.App}
                                onChange={(e) => field.onChange(e.target.value as AppType)}
                                className="text-blue-600"
                              />
                              <span className="text-sm">Application</span>
                            </label>
                          </div>
                        )}
                      />
                    </Field>

                    <Field>
                      <div className="flex items-center justify-between mb-2">
                        <FieldLabel>Project Entries</FieldLabel>
                        <Button type="button" variant="outline" size="sm" onClick={addEditingEntry}>
                          <PlusIcon className="h-4 w-4 mr-1" />
                          Add Entry
                        </Button>
                      </div>
                      <FieldDescription>
                        Store project entries path for projects that cannot find entries by static
                        analysis
                      </FieldDescription>

                      <Controller
                        name="entries"
                        control={editControl}
                        render={({ field }) => (
                          <div>
                            {field.value && field.value.length === 0 ? (
                              <div className="text-center py-4 border border-dashed border-gray-300 rounded-md">
                                <p className="text-sm text-gray-500">No entries added yet</p>
                              </div>
                            ) : (
                              <div className="space-y-3 max-h-80 overflow-y-auto">
                                {field.value?.map((entry, index) => (
                                  <div
                                    key={index}
                                    className="space-y-2 p-3 border border-gray-200 rounded-md"
                                  >
                                    <div className="flex gap-2 items-center">
                                      <div className="flex-1">
                                        <label className="block text-xs font-medium mb-1 text-gray-600">
                                          Entry Name
                                        </label>
                                        <Input
                                          value={entry.name}
                                          onChange={(e) =>
                                            updateEditingEntry(index, 'name', e.target.value)
                                          }
                                          placeholder="Entry name"
                                          className="w-full"
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <label className="block text-xs font-medium mb-1 text-gray-600">
                                          Entry Path
                                        </label>
                                        <Input
                                          value={entry.path}
                                          onChange={(e) =>
                                            updateEditingEntry(index, 'path', e.target.value)
                                          }
                                          placeholder="/path/to/entry"
                                          className="w-full"
                                        />
                                      </div>
                                      <div className="flex-shrink-0 self-end">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => removeEditingEntry(index)}
                                          className="mt-6"
                                        >
                                          <XIcon className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
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
                        onClick={() => setEditingProject(null)}
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
      </div>
    </TooltipProvider>
  )
}

export default function ProjectsPage() {
  return (
    <SWRConfig value={swrConfig}>
      <Suspense fallback={<div className="min-h-screen bg-gray-50 p-6">Loading projects...</div>}>
        <ProjectsContent />
      </Suspense>
    </SWRConfig>
  )
}
