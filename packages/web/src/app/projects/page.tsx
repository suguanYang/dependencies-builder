'use client'

import React, { useState, Suspense } from 'react'
import useSWR, { SWRConfig, mutate } from 'swr'
import { PlusIcon, TrashIcon, EditIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircleIcon } from 'lucide-react'
import { swrConfig } from '@/lib/swr-config'
import { type Project, type ProjectQuery, getProjects, deleteProject, createProject, updateProject } from '@/lib/api'
import { VirtualTable } from '@/components/virtual-table'
import { useRouter, useSearchParams } from 'next/navigation'

function ProjectsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [error, setError] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [searchFilters, setSearchFilters] = useState<ProjectQuery>({
    name: '',
    addr: ''
  })

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

  const [newProject, setNewProject] = useState({
    name: '',
    addr: '',
    entries: {}
  })

  // Fetch projects with server-side filtering
  const { data: projectsResponse, isLoading } = useSWR(
    ['projects', searchFilters, currentPage, pageSize],
    () => getProjects({
      name: searchFilters.name || undefined,
      addr: searchFilters.addr || undefined,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize
    })
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

  const handleCreate = async () => {
    try {
      await createProject(newProject)
      setIsCreating(false)
      setNewProject({
        name: '',
        addr: '',
        entries: {}
      })
      // Refresh the projects data
      mutate(['projects', searchFilters, currentPage, pageSize])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    }
  }

  const handleUpdate = async () => {
    if (!editingProject) return
    try {
      await updateProject(editingProject.id, {
        name: editingProject.name,
        addr: editingProject.addr,
        entries: editingProject.entries
      })
      setEditingProject(null)
      // Refresh the projects data
      mutate(['projects', searchFilters, currentPage, pageSize])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project')
    }
  }

  return (
    <div className="pt-6 px-6">
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
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
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Project Address</label>
                <Input
                  placeholder="Partial match address"
                  value={searchFilters.addr}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, addr: e.target.value }))}
                />
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
              height={pageSize >= 20 ? "70vh" : "640px"}
              itemHeight={64}
              columns={[
                { key: 'id', header: 'ID', width: 200 },
                {
                  key: 'name',
                  header: 'Name',
                  width: '300',
                  render: (project: Project) => (
                    <div className="font-medium text-blue-600 truncate">
                      {project.name}
                    </div>
                  )
                },
                {
                  key: 'addr',
                  header: 'Address',
                  width: '400',
                  render: (project: Project) => (
                    <div className="truncate text-sm text-gray-600">
                      {project.addr}
                    </div>
                  )
                },
                {
                  key: 'createdAt',
                  header: 'Created',
                  width: 120,
                  render: (project: Project) => (
                    <div className="text-sm text-gray-500">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </div>
                  )
                }
              ]}
              actions={(project) => (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingProject(project)}
                  >
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
                onPageSizeChange: handlePageSizeChange
              }}
            />
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Project</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Project Name</label>
                <Input
                  value={newProject.name}
                  onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Project name (must be unique)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Project Address</label>
                <Input
                  value={newProject.addr}
                  onChange={(e) => setNewProject(prev => ({ ...prev, addr: e.target.value }))}
                  placeholder="Project address/path"
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

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Project</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Project Name</label>
                <Input
                  value={editingProject.name}
                  onChange={(e) => setEditingProject(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  placeholder="Project name (must be unique)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Project Address</label>
                <Input
                  value={editingProject.addr}
                  onChange={(e) => setEditingProject(prev => prev ? ({ ...prev, addr: e.target.value }) : null)}
                  placeholder="Project address/path"
                />
              </div>

              <div className="flex space-x-4">
                <Button onClick={handleUpdate} className="flex-1">
                  Update
                </Button>
                <Button variant="outline" onClick={() => setEditingProject(null)} className="flex-1">
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

export default function ProjectsPage() {
  return (
    <SWRConfig value={swrConfig}>
      <Suspense fallback={<div className="min-h-screen bg-gray-50 p-6">Loading projects...</div>}>
        <ProjectsContent />
      </Suspense>
    </SWRConfig>
  )
}