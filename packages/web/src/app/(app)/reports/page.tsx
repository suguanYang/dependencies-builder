'use client'

import { useState } from 'react'
import useSWR, { SWRConfig, mutate } from 'swr'
import { EyeIcon, AlertCircleIcon, AlertTriangleIcon, Sparkles, Share2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { swrConfig } from '@/lib/swr-config'
import { DeleteButton } from '@/components/delete-button'
import { getActions, getActionById, getConnectionsList, getNodes, deleteAction } from '@/lib/api'
import { Action, Node, ImpactReport } from '@/lib/server-types'
import { ImpactAnalysisCard } from '@/components/ImpactAnalysisCard'
function ReportsContent() {
  // State for error handling
  const [error, setError] = useState<string>('')

  const { data: actionsResponse, isLoading } = useSWR('reports-actions', () =>
    getActions({
      type: 'report' as any,
    }),
  )

  const actions = actionsResponse?.data || []
  const reportActions = actions.filter(
    (action) => action.type === 'report' && action.status === 'completed',
  )

  // Helper functions
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

    return result.affectedToNodes.some(
      (node: any) => node.version && node.version !== result.targetVersion,
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
          {reportActions.map((action: Action) => {
            // Check if this report has affected nodes or connections
            const hasNodes = action.result?.affectedToNodes?.length > 0
            const hasConnections = action.result?.connections?.length > 0
            const hasWarnings = hasNodes || hasConnections
            const hasImpactAnalysis = !!action.result?.impactAnalysis
            const impactLevel = action.result?.impactAnalysis?.level

            return (
              <Card key={action.id} className="hover:shadow-lg transition-shadow relative">
                {/* Warning indicator for reports with affected nodes or connections */}
                {hasWarnings && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    {hasImpactAnalysis && <Sparkles className="h-5 w-5 text-purple-500" />}
                    <AlertTriangleIcon className="h-5 w-5 text-yellow-500" />
                  </div>
                )}
                {/* AI indicator when no warnings */}
                {!hasWarnings && hasImpactAnalysis && (
                  <div className="absolute top-2 right-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                  </div>
                )}

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

                    {/* Impact Level Badge */}
                    {hasImpactAnalysis && impactLevel && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Impact:</span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            impactLevel === 'low'
                              ? 'bg-green-100 text-green-700'
                              : impactLevel === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {impactLevel.toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <Link href={`/reports/detail?id=${action.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <EyeIcon className="h-4 w-4 mr-2" />
                          View Report
                        </Button>
                      </Link>
                      <DeleteButton
                        item={action}
                        getDisplayName={(action) => `Report for ${action.parameters.projectName}`}
                        onDelete={async (action) => {
                          await deleteAction(action.id)
                          // Refresh the reports list
                          mutate('reports-actions')
                        }}
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete Report"
                        description="Are you sure you want to delete this report? This action cannot be undone."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
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
