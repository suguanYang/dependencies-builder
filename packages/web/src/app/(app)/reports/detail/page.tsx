'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, Share2Icon, Printer, Sparkles, AlertCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getActionById } from '@/lib/api'
import type { ImpactReport } from '@/lib/server-types'
import { ImpactAnalysisCard } from '@/components/ImpactAnalysisCard'

/**
 * Shareable Report Detail Page (Static Export Compatible)
 * Uses query parameters instead of dynamic routes
 * Accessible via /reports/detail?id=[actionId]
 */
export default function ReportDetailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const actionId = searchParams.get('id')

  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchReport() {
      if (!actionId) {
        setError('Report ID is required')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { result, parameters, createdAt } = await getActionById(actionId)
        setReport({ result, parameters, createdAt })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch report')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [actionId])

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-gray-700">Loading report...</div>
          <div className="text-sm text-gray-500 mt-2">Please wait</div>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error Loading Report</AlertTitle>
          <AlertDescription>
            {error || 'Report not found'}
            <Button
              variant="outline"
              size="sm"
              className="ml-2 mt-2"
              onClick={() => router.push('/reports')}
            >
              Back to Reports
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const hasImpactAnalysis = !!report.result?.impactAnalysis

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Header - Hidden on print */}
      <div className="bg-white border-b print:hidden">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push('/reports')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Reports
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-xl font-semibold text-gray-900">Report Details</h1>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2Icon className="h-4 w-4 mr-2" />
                {copied ? 'Copied!' : 'Share'}
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 print:px-0">
        {/* Print Header - Only visible on print */}
        <div className="hidden print:block mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dependency Report</h1>
          <p className="text-sm text-gray-600 mt-2">
            Generated on {new Date(report.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Report Metadata */}
        <Card className="mb-6 print:shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{report.parameters.projectName}</span>
              {hasImpactAnalysis && (
                <span className="flex items-center gap-2 text-sm font-normal text-purple-600">
                  <Sparkles className="h-4 w-4" />
                  AI Analyzed
                </span>
              )}
            </CardTitle>
            <CardDescription>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <div className="text-xs text-gray-500">Source Branch</div>
                  <div className="font-medium text-gray-900">{report.parameters.branch}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Target Branch</div>
                  <div className="font-medium text-gray-900">{report.parameters.targetBranch}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Generated</div>
                  <div className="font-medium text-gray-900">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Report ID</div>
                  <div className="font-mono text-xs text-gray-600">{actionId?.slice(0, 8)}...</div>
                </div>
              </div>
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Affected Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {report.result?.affectedToNodes?.length || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Export points modified</p>
            </CardContent>
          </Card>

          <Card className="print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Impacted Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {report.result?.affecatedConnections?.length || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Dependencies affected</p>
            </CardContent>
          </Card>

          <Card className="print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Impact Level</CardTitle>
            </CardHeader>
            <CardContent>
              {hasImpactAnalysis && report.result.impactAnalysis?.level ? (
                <>
                  <div
                    className={`inline-block text-lg font-bold px-3 py-1 rounded-full ${
                      report.result.impactAnalysis.level === 'low'
                        ? 'bg-green-100 text-green-700'
                        : report.result.impactAnalysis.level === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {report.result.impactAnalysis.level.toUpperCase()}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">AI-assessed severity</p>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold text-gray-400">—</div>
                  <p className="text-xs text-gray-500 mt-1">Not analyzed</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* LLM Impact Analysis */}
        {hasImpactAnalysis && (
          <div className="mb-6 break-inside-avoid">
            <ImpactAnalysisCard impactAnalysis={report.result.impactAnalysis as ImpactReport} />
          </div>
        )}

        {/* Affected Nodes */}
        <Card className="mb-6 print:shadow-none break-inside-avoid">
          <CardHeader>
            <CardTitle>Affected Export Nodes</CardTitle>
            <CardDescription>Code changes that may impact dependent projects</CardDescription>
          </CardHeader>
          <CardContent>
            {report.result?.affectedToNodes?.length > 0 ? (
              <div className="space-y-2">
                {report.result.affectedToNodes.map((node: any, index: number) => (
                  <div
                    key={node.id || index}
                    className="bg-gray-50 p-3 rounded-md border border-gray-200 print:border-gray-300"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{node.name}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          <span className="font-mono">{node.relativePath}</span>
                          {node.startLine && (
                            <span className="ml-2 text-gray-400">
                              Lines {node.startLine}-{node.endLine}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {node.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertCircleIcon className="h-4 w-4" />
                <AlertDescription>No affected nodes found</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Impacted Connections */}
        <Card className="mb-6 print:shadow-none break-inside-avoid">
          <CardHeader>
            <CardTitle>Impacted Dependencies</CardTitle>
            <CardDescription>Projects that depend on the changed code</CardDescription>
          </CardHeader>
          <CardContent>
            {report.result?.affecatedConnections?.length > 0 ? (
              <div className="space-y-2">
                {report.result.affecatedConnections.slice(0, 20).map((conn: any, index: number) => (
                  <div
                    key={conn.id || index}
                    className="bg-gray-50 p-3 rounded-md border border-gray-200 print:border-gray-300"
                  >
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">
                        {conn.fromNode?.projectName || 'Unknown'}
                      </span>
                      <span className="text-gray-400 mx-2">→</span>
                      <span className="font-medium text-gray-900">
                        {conn.toNode?.projectName || 'Unknown'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {conn.fromNode?.name} ({conn.fromNode?.type}) → {conn.toNode?.name} (
                      {conn.toNode?.type})
                    </div>
                  </div>
                ))}
                {report.result.affecatedConnections.length > 20 && (
                  <div className="text-center text-sm text-gray-500 py-2">
                    ... and {report.result.affecatedConnections.length - 20} more connections
                  </div>
                )}
              </div>
            ) : (
              <Alert>
                <AlertCircleIcon className="h-4 w-4" />
                <AlertDescription>No impacted connections found</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Footer - Hidden on print */}
        <div className="text-center text-sm text-gray-500 mt-8 print:hidden">
          <p>
            This report was generated by the Dependency Management System (DMS).
            {hasImpactAnalysis && ' AI analysis powered by LLM integration.'}
          </p>
        </div>
      </div>

      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 1.5cm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .break-inside-avoid {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}
