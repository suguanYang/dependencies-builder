'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import useSWR, { SWRConfig } from 'swr'
import { AlertCircleIcon, NetworkIcon, ListIcon, PlayIcon } from 'lucide-react'
import { DependencyGraph } from '@/components/dependency-graph'
import { ProjectQuery, type SearchFilters } from '@/components/project-query'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { swrConfig } from '@/lib/swr-config'
import { type Node, type Connection } from '@/lib/api'

function HomeContent() {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({})
  const [nodes, setNodes] = useState<Node[]>([])
  const [connections, setConnections] = useState<Connection[]>([])

  const { data: nodesData, error: nodesError, isLoading: nodesLoading } = useSWR(
    Object.keys(searchFilters).length > 0
      ? `/nodes?${new URLSearchParams(searchFilters as any).toString()}`
      : '/nodes?limit=50'
  )

  const { data: connectionsData, error: connectionsError } = useSWR(
    nodes.length > 0
      ? `/connections?limit=100`
      : null
  )

  const handleSearch = (filters: SearchFilters) => {
    // Filter out undefined values before setting search filters
    const filteredFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
    ) as SearchFilters
    setSearchFilters(filteredFilters)
  }

  React.useEffect(() => {
    if (nodesData) {
      setNodes(nodesData.data || nodesData)
    }
  }, [nodesData])

  React.useEffect(() => {
    if (connectionsData) {
      setConnections(connectionsData.data || connectionsData)
    }
  }, [connectionsData])

  const error = nodesError || connectionsError
  const isLoading = nodesLoading

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dependency Management System</h1>
        <p className="text-gray-600 mt-2">Visualize and manage project dependencies</p>
        
        <div className="mt-4 flex space-x-4">
          <Link href="/nodes">
            <Button variant="outline">
              <ListIcon className="h-4 w-4 mr-2" />
              Manage Nodes
            </Button>
          </Link>
          <Link href="/connections">
            <Button variant="outline">
              <NetworkIcon className="h-4 w-4 mr-2" />
              Manage Connections
            </Button>
          </Link>
          <Link href="/actions">
            <Button variant="outline">
              <PlayIcon className="h-4 w-4 mr-2" />
              Manage Actions
            </Button>
          </Link>
        </div>
      </header>

      <ProjectQuery onSearch={handleSearch} isLoading={isLoading} a={true} />

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error.message}
          </AlertDescription>
        </Alert>
      )}

      {nodes.length > 0 && (
        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Dependency Graph</h2>
            <p className="text-gray-600">
              Showing {nodes.length} nodes and {connections.length} connections
              {Object.keys(searchFilters).length > 0 && ' (filtered)'}
            </p>
          </div>
          
          <DependencyGraph 
            nodes={nodes} 
            connections={connections} 
            width={1000}
            height={600}
          />
        </div>
      )}

      {!isLoading && nodes.length === 0 && !error && Object.keys(searchFilters).length > 0 && (
        <div className="mt-12 text-center text-gray-500">
          <p>No nodes found matching your search criteria.</p>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <SWRConfig value={swrConfig}>
      <HomeContent />
    </SWRConfig>
  )
}