'use client'

import React, { useState } from 'react'
import useSWR, { SWRConfig } from 'swr'
import { EyeIcon, AlertCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { swrConfig } from '@/lib/swr-config'
import {
  type Action,
  getActions,
  getActionById,
  getConnectionsList,
  getNodes,
  Node,
} from '@/lib/api'
function ReportsContent() {
  const [error, setError] = useState<string>('')
  const [viewingReport, setViewingReport] = useState<{
    actionId: string
    result: any
    connections: any[]
  } | null>(null)

  const { data: actionsResponse, isLoading } = useSWR('reports-actions', () =>
    getActions({
      type: 'report',
    }),
  )

  const actions = actionsResponse?.data || []
  const reportActions = actions.filter(
    (action) => action.type === 'report' && action.status === 'completed',
  )

  const handleViewReport = async (actionId: string) => {
    try {
      const { result } = await getActionById(actionId)

      // Query connections for affected nodes by matching node properties
      const connectionsPromises =
        result?.affectedToNodes?.map(async (node: Node) => {
          // Try to find the node in the database by its properties
          const nodesResponse = await getNodes({
            projectName: node.projectName,
            branch: node.branch,
            type: node.type,
            name: node.name,
            limit: 1,
          })

          if (nodesResponse.data.length > 0) {
            const dbNode = nodesResponse.data[0]
            // Query connections for this node
            const connectionsResponse = await getConnectionsList({ toId: dbNode.id, limit: 50 })
            return connectionsResponse.data
          }
          return []
        }) || []

      const connectionsArrays = await Promise.all(connectionsPromises)
      const connections = connectionsArrays.flat()

      setViewingReport({ actionId, result, connections })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report result')
    }
  }

  const getAffectedNodesCount = (result: any) => {
    return result?.affectedToNodes?.length || 0
  }

  const getImpactedConnectionsCount = (connections: any[]) => {
    return connections.length
  }

  const hasVersionMismatch = (result: any) => {
    if (!result?.affectedToNodes || !result.targetVersion) {
      return false
    }

    return result.affectedToNodes.some((node: any) =>
      node.version && node.version !== result.targetVersion
    )
  }

  return (
    <div className="pt-6 px-6">
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" className="ml-2" onClick={() => setError('')}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading reports...</p>
        </div>
      )}

      {!isLoading && reportActions.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No completed reports found. Generate a report first.</p>
          <Link href="/actions" className="mt-4 inline-block">
            <Button>Create Report</Button>
          </Link>
        </div>
      )}

      {!isLoading && reportActions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportActions.map((action: Action) => (
            <Card key={action.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-sm">{action.parameters.projectName}</CardTitle>
                <CardDescription>
                  Branch: {action.parameters.branch}
                  <br />
                  Created: {new Date(action.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium text-green-600 bg-green-100">
                      {action.status}
                    </span>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewReport(action.id)}
                    >
                      <EyeIcon className="h-4 w-4 mr-2" />
                      View Report
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Report Modal */}
      {viewingReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">Report Details</h3>
                <p className="text-sm text-gray-500">Action ID: {viewingReport.actionId}</p>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setViewingReport(null)}>
                  Close
                </Button>
              </div>
            </div>

            {/* Version Mismatch Warning */}
            {viewingReport.result && hasVersionMismatch(viewingReport.result) && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircleIcon className="h-4 w-4" />
                <AlertTitle>Version Mismatch Warning</AlertTitle>
                <AlertDescription>
                  Affected nodes have versions that do not match the target branch version ({viewingReport.result.targetVersion}).
                  This indicate that the analysis was performed on outdated code. The Report may not accurate! You should run a
                  new Static Analysis on the target branch before run the same Report again.
                </AlertDescription>
              </Alert>
            )}

            {/* Report Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Affected Nodes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {getAffectedNodesCount(viewingReport.result)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Impacted Connections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {getImpactedConnectionsCount(viewingReport.connections)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Analysis Date</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">{new Date().toLocaleDateString()}</div>
                </CardContent>
              </Card>
            </div>

            {/* Affected Nodes Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-4">Affected Nodes</h4>
              {viewingReport.result.affectedToNodes?.length > 0 ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-3">
                    {viewingReport.result.affectedToNodes
                      .slice(0, 10)
                      .map((node: any, index: number) => (
                        <div key={node.id || index} className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{node.name}</div>
                              <div className="text-sm text-gray-500">
                                {node.type} • {node.relativePath}
                              </div>
                            </div>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                              {node.type}
                            </span>
                          </div>
                          {node.startLine && (
                            <div className="text-xs text-gray-400 mt-1">
                              Lines: {node.startLine}-{node.endLine}
                            </div>
                          )}
                        </div>
                      ))}
                    {viewingReport.result.affectedToNodes.length > 10 && (
                      <div className="text-center text-gray-500 text-sm">
                        ... and {viewingReport.result.affectedToNodes.length - 10} more nodes
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertTitle>No Affected Nodes</AlertTitle>
                  <AlertDescription>
                    No nodes were found to be affected by the changes.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Impacted Connections Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-4">Impacted Connections</h4>
              {viewingReport.connections.length > 0 ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-3">
                    {viewingReport.connections
                      .slice(0, 10)
                      .map((connection: any, index: number) => (
                        <div key={connection.id || index} className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">
                                {connection.fromNode?.projectName} →{' '}
                                {connection.toNode?.projectName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {connection.fromNode?.name || 'Unknown'}({connection.fromNode?.type}
                                ) →{connection.toNode?.name || 'Unknown'}({connection.toNode?.type})
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    {viewingReport.connections.length > 10 && (
                      <div className="text-center text-gray-500 text-sm">
                        ... and {viewingReport.connections.length - 10} more connections
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertTitle>No Impacted Connections</AlertTitle>
                  <AlertDescription>
                    No connections were found to be impacted by the affected nodes.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Raw Report Data (Collapsible) */}
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                Raw Report Data
              </summary>
              <div className="mt-2 bg-gray-50 p-4 rounded-lg">
                <pre className="text-sm overflow-auto bg-white p-4 rounded border">
                  {JSON.stringify(viewingReport.result, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <SWRConfig value={swrConfig}>
      <ReportsContent />
    </SWRConfig>
  )
}
