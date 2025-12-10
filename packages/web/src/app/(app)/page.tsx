'use client'

import React from 'react'
import Link from 'next/link'
import useSWR, { SWRConfig } from 'swr'
import {
  AlertCircleIcon,
  NetworkIcon,
  ListIcon,
  PlayIcon,
  AlertTriangleIcon,
  InfoIcon,
  CheckCircleIcon,
  TrendingUpIcon,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { swrConfig } from '@/lib/swr-config'
import { getNodes, getConnectionsList, getActions } from '@/lib/api'
import { Node } from '@/lib/server-types'
function HomeContent() {
  const { data: nodesResponse } = useSWR('dashboard-nodes', () => getNodes({ limit: 1 }))
  const { data: connectionsResponse } = useSWR('dashboard-connections', () =>
    getConnectionsList({ limit: 1 }),
  )
  const { data: standaloneNodesResponse } = useSWR('dashboard-standalone-nodes', () =>
    getNodes({ standalone: true, limit: 1 }),
  )
  const { data: reportsesponse } = useSWR('dashboard-actions', () =>
    getActions({
      type: 'report',
    }),
  )

  const nodes = nodesResponse?.data || []
  const connections = connectionsResponse?.data || []
  const standaloneNodes = standaloneNodesResponse?.data || []
  const reportActions = reportsesponse?.data || []

  // Calculate dashboard statistics
  const totalNodes = nodesResponse?.total || 0
  const totalConnections = connectionsResponse?.total || 0
  const standaloneNodesCount = standaloneNodesResponse?.total || 0

  // Calculate report statistics
  const completedReports = reportActions.filter((action) => action.status === 'completed').length
  const failedReports = reportActions.filter((action) => action.status === 'failed').length

  const { data: autoCreateAction } = useSWR('dashboard-auto-create-action', () =>
    getActions({
      type: 'connection_auto_create',
      limit: 1,
    }),
  )

  const cycles = (autoCreateAction?.data?.[0]?.result as any)?.cycles || []

  // Find nodes with many dependencies (potential bottlenecks)
  const dependencyCounts: Record<string, number> = {}
  connections.forEach((conn) => {
    dependencyCounts[conn.fromId] = (dependencyCounts[conn.fromId] || 0) + 1
  })
  const highDependencyNodes = Object.entries(dependencyCounts)
    .filter(([_, count]) => count > 5)
    .map(([nodeId]) => nodes.find((n) => n.id === nodeId))
    .filter(Boolean) as Node[]

  return (
    <div className="pt-6 px-6">
      <header className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dependency Management System</h1>
            <p className="text-gray-600 mt-2">Monitor and manage project dependencies</p>
          </div>
          <Link href="/docs/getting-started">
            <Button variant="outline" size="sm">
              Documentation
            </Button>
          </Link>
        </div>
      </header>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
            <ListIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNodes}</div>
            <p className="text-xs text-muted-foreground">All dependency nodes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Connections</CardTitle>
            <NetworkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConnections}</div>
            <p className="text-xs text-muted-foreground">Dependency relationships</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Standalone Nodes</CardTitle>
            <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link href="/nodes?standalone=true">
              <div className="text-2xl font-bold hover:text-blue-600 cursor-pointer transition-colors">
                {standaloneNodesCount}
              </div>
            </Link>
            <p className="text-xs text-muted-foreground">Nodes with no connections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Circular Dependencies</CardTitle>
            <AlertCircleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cycles.length}</div>
            <p className="text-xs text-muted-foreground">Potential cycles detected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reports</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedReports}</div>
            <p className="text-xs text-muted-foreground">
              {failedReports > 0 ? `${failedReports} failed` : 'All successful'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Warnings and Issues */}
      <div className="space-y-6">
        {/* Circular Dependencies Warning */}
        {cycles.length > 0 && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Circular Dependencies Detected</AlertTitle>
            <AlertDescription>
              Found {cycles.length} potential circular dependency chains. These can cause infinite
              loops and runtime errors.
              <div className="mt-2 text-sm">
                {cycles.slice(0, 3).map((cycle, index) => (
                  <div key={index} className="font-mono text-xs bg-red-100 p-2 rounded mt-1">
                    Cycle {index + 1}:{' '}
                    {cycle
                      .map((id) => {
                        const node = nodes.find((n) => n.id === id)
                        return node?.name || id
                      })
                      .join(' → ')}
                  </div>
                ))}
                {cycles.length > 3 && (
                  <div className="text-xs text-gray-600 mt-1">
                    ... and {cycles.length - 3} more cycles
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Standalone Nodes Warning */}
        {standaloneNodesCount > 0 && (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Standalone Nodes</AlertTitle>
            <AlertDescription>
              Found {standaloneNodesCount} nodes with no connections. These might be unused or
              orphaned dependencies.
              <div className="mt-2 text-sm">
                {standaloneNodes.slice(0, 5).map((node) => (
                  <div key={node.id} className="font-mono text-xs bg-blue-100 p-2 rounded mt-1">
                    {node.name} ({node.type})
                  </div>
                ))}
                {standaloneNodesCount > 5 && (
                  <div className="text-xs text-gray-600 mt-1">
                    ... and {standaloneNodesCount - 5} more standalone nodes
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* High Dependency Nodes Warning */}
        {highDependencyNodes.length > 0 && (
          <Alert>
            <TrendingUpIcon className="h-4 w-4" />
            <AlertTitle>High Dependency Nodes</AlertTitle>
            <AlertDescription>
              Found {highDependencyNodes.length} nodes with many outgoing dependencies. These might
              be potential bottlenecks.
              <div className="mt-2 text-sm">
                {highDependencyNodes.slice(0, 5).map((node) => (
                  <div key={node.id} className="font-mono text-xs bg-yellow-100 p-2 rounded mt-1">
                    {node.name} ({node.type}) - {dependencyCounts[node.id]} dependencies
                  </div>
                ))}
                {highDependencyNodes.length > 5 && (
                  <div className="text-xs text-gray-600 mt-1">
                    ... and {highDependencyNodes.length - 5} more high-dependency nodes
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* All Clear Message */}
        {cycles.length === 0 && standaloneNodesCount === 0 && highDependencyNodes.length === 0 && (
          <Alert>
            <CheckCircleIcon className="h-4 w-4" />
            <AlertTitle>All Systems Clear</AlertTitle>
            <AlertDescription>
              No critical issues detected in your dependency graph. Your system appears to be
              well-structured.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Recent Reports */}
      {reportActions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Recent Reports</h2>
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                    Project
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reportActions.slice(0, 5).map((action) => (
                  <tr key={action.id}>
                    <td className="px-4 py-4 text-sm text-gray-900 truncate">
                      {action.parameters.projectName}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 truncate">
                      {action.parameters.projectAddr}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 truncate">
                      {action.parameters.branch}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          action.status === 'completed'
                            ? 'text-green-600 bg-green-100'
                            : action.status === 'running'
                              ? 'text-blue-600 bg-blue-100'
                              : action.status === 'failed'
                                ? 'text-red-600 bg-red-100'
                                : 'text-yellow-600 bg-yellow-100'
                        }`}
                      >
                        {action.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {new Date(action.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reportActions.length > 5 && (
              <div className="px-6 py-3 bg-gray-50 text-center">
                <Link href="/reports">
                  <Button variant="outline" size="sm">
                    View All Reports
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Auto-create Connections</CardTitle>
              <CardDescription>
                Automatically detect and create missing dependencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/connections">
                <Button className="w-full">
                  <NetworkIcon className="h-4 w-4 mr-2" />
                  Run Auto-create
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Analyze Dependencies</CardTitle>
              <CardDescription>Run static analysis on your projects</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/actions">
                <Button className="w-full" variant="outline">
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Start Analysis
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Generate Report</CardTitle>
              <CardDescription>Create comprehensive dependency analysis report</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/actions">
                <Button className="w-full" variant="outline">
                  <TrendingUpIcon className="h-4 w-4 mr-2" />
                  Create Report
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">View All Nodes</CardTitle>
              <CardDescription>Browse and manage all dependency nodes</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/nodes">
                <Button className="w-full" variant="outline">
                  <ListIcon className="h-4 w-4 mr-2" />
                  Browse Nodes
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
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
