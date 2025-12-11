'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircleIcon } from 'lucide-react'
import { getNode } from '@/lib/api'
import { useSearchParams, useRouter } from 'next/navigation'
import { Node } from '@/lib/server-types'
import { generatePermanentLink } from '@/lib/links'

function NodeDetailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const nodeId = searchParams.get('id')

  const [node, setNode] = useState<Node | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!nodeId) {
      setError('No node ID provided')
      return
    }

    const fetchNode = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const nodeData = await getNode(nodeId)
        setNode(nodeData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load node details')
      } finally {
        setIsLoading(false)
      }
    }

    fetchNode()
  }, [nodeId])

  if (!nodeId) {
    return (
      <div className="pt-6 px-6">
        <Alert variant="destructive" className="mb-6">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No node ID provided. Please navigate from the nodes or connections page.
          </AlertDescription>
        </Alert>
        <Link href="/nodes">
          <Button>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Nodes
          </Button>
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="pt-6 px-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Loading node details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="pt-6 px-6">
        <Alert variant="destructive" className="mb-6">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Link href="/nodes">
          <Button>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Nodes
          </Button>
        </Link>
      </div>
    )
  }

  if (!node) {
    return (
      <div className="pt-6 px-6">
        <Alert variant="destructive" className="mb-6">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Node not found</AlertDescription>
        </Alert>
        <Link href="/nodes">
          <Button>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Nodes
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="pt-6 px-6">
      <div className="mb-6">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">ID</label>
              <p className="text-sm font-mono bg-gray-50 p-2 rounded">{node.id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
              <p className="text-sm">{node.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Project</label>
              <p className="text-sm">{node.projectName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Type</label>
              <p className="text-sm">{node.type}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Branch</label>
              <p className="text-sm">{node.branch}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Version</label>
                <p className="text-sm">{node.version || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">QLS version</label>
                <p className="text-sm">{node.qlsVersion || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Location Information */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Location Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Relative Path</label>
              <p className="text-sm font-mono bg-gray-50 p-2 rounded">
                {node.relativePath || 'N/A'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Start Line</label>
                <p className="text-sm">{node.startLine || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Start Column</label>
                <p className="text-sm">{node.startColumn || 'N/A'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">End Line</label>
                <p className="text-sm">{node.endLine || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">End Column</label>
                <p className="text-sm">{node.endColumn || 'N/A'}</p>
              </div>
            </div>
            {(() => {
              const permanentLink = generatePermanentLink(node, node.project?.addr)
              if (!permanentLink) return null
              return (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Permanent Link</label>
                  <a
                    href={permanentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    Open in Repository
                  </a>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-white p-6 rounded-lg shadow-sm border lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Metadata</h2>
          {node.meta && Object.keys(node.meta).length > 0 ? (
            <pre className="text-sm bg-gray-50 p-4 rounded border overflow-auto">
              {JSON.stringify(node.meta, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500">No metadata available</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NodeDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-6">Loading node details...</div>}>
      <NodeDetailContent />
    </Suspense>
  )
}
