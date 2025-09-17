'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface ProjectQueryProps {
  onSearch: (filters: SearchFilters) => void
  isLoading?: boolean
  a?: boolean
}

export interface SearchFilters {
  project?: string
  branch?: string
  type?: string
  name?: string
}

export function ProjectQuery({ onSearch, isLoading = false, ...rest }: ProjectQueryProps) {
  const [filters, setFilters] = useState<SearchFilters>({})

  const handleSearch = () => {
    onSearch(filters)
  }

  useEffect(() => {
    console.log('rest', rest)
  }, [rest])

  const handleInputChange = (field: keyof SearchFilters, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value
    }))
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h2 className="text-xl font-semibold mb-4">Project Query</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label htmlFor="project-input" className="block text-sm font-medium mb-2">Project</label>
          <input
            id="project-input"
            type="text"
            placeholder="Project name"
            className="w-full px-3 py-2 border rounded-md"
            value={filters.project ?? ''}
            onChange={(e) => handleInputChange('project', e.target.value || undefined)}
          />
        </div>

        <div>
          <label htmlFor="branch-input" className="block text-sm font-medium mb-2">Branch</label>
          <input
            id="branch-input"
            type="text"
            placeholder="Branch name"
            className="w-full px-3 py-2 border rounded-md"
            value={filters.branch ?? ''}
            onChange={(e) => handleInputChange('branch', e.target.value || undefined)}
          />
        </div>

        <div>
          <label htmlFor="type-select" className="block text-sm font-medium mb-2">Type</label>
          <select
            id="type-select"
            className="w-full px-3 py-2 border rounded-md"
            value={filters.type ?? ''}
            onChange={(e) => handleInputChange('type', e.target.value || undefined)}
          >
            <option value="">All types</option>
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
          <label htmlFor="name-input" className="block text-sm font-medium mb-2">Name</label>
          <input
            id="name-input"
            type="text"
            placeholder="Dependency name"
            className="w-full px-3 py-2 border rounded-md"
            value={filters.name ?? ''}
            onChange={(e) => handleInputChange('name', e.target.value || undefined)}
          />
        </div>
      </div>

      <Button 
        onClick={handleSearch}
        disabled={isLoading}
        className="w-full md:w-auto"
      >
        {isLoading ? 'Searching...' : 'Search Projects'}
      </Button>
    </div>
  )
}