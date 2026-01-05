'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { generatePermanentLink } from '@/lib/links'

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

  // Helper to generate MR Link
  const getMergeRequestLink = () => {
    if (!report?.parameters) return null
    const { projectAddr, branch, targetBranch } = report.parameters
    if (!projectAddr || !branch || !targetBranch) return null

    // Clean address
    const baseUrl = projectAddr.replace(/\.git$/, '').replace(/\/$/, '')
    return `${baseUrl}/-/merge_requests/new?merge_request[source_branch]=${branch}&merge_request[target_branch]=${targetBranch}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-gray-700">加载报告中...</div>
          <div className="text-sm text-gray-500 mt-2">请稍候</div>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>无法加载报告</AlertTitle>
          <AlertDescription>
            {error || '未找到报告'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const hasImpactAnalysis = !!report.result?.impactAnalysis
  const mrLink = getMergeRequestLink()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-gray-900">报告详情</h1>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2Icon className="h-4 w-4 mr-2" />
                {copied ? '已复制!' : '分享'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Report Metadata */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{report.parameters.projectName}</span>
              {hasImpactAnalysis && (
                <span className="flex items-center gap-2 text-sm font-normal text-purple-600">
                  <Sparkles className="h-4 w-4" />
                  AI
                </span>
              )}
            </CardTitle>
            <CardDescription>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <div className="text-xs text-gray-500">源分支</div>
                  <div className="font-medium text-gray-900">{report.parameters.branch}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">目标分支</div>
                  <div className="font-medium text-gray-900">{report.parameters.targetBranch}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">生成时间</div>
                  <div className="font-medium text-gray-900">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">受影响节点</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {report.result?.affectedToNodes?.length || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">个导出点被修改</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">受影响依赖</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {report.result?.affecatedConnections?.length || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">个依赖项受到影响</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">影响等级</CardTitle>
            </CardHeader>
            <CardContent>
              {hasImpactAnalysis && report.result.impactAnalysis?.level ? (
                <>
                  <div
                    className={`inline-block text-lg font-bold px-3 py-1 rounded-full ${report.result.impactAnalysis.level === 'low'
                      ? 'bg-green-100 text-green-700'
                      : report.result.impactAnalysis.level === 'medium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                      }`}
                  >
                    {report.result.impactAnalysis.level.toUpperCase()}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">AI 评估严重程度</p>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold text-gray-400">—</div>
                  <p className="text-xs text-gray-500 mt-1">未分析</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* LLM Impact Analysis */}
        {hasImpactAnalysis && (
          <div className="mb-6">
            <ImpactAnalysisCard impactAnalysis={report.result.impactAnalysis as ImpactReport} />
          </div>
        )}

        {/* Impacted Connections */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>受影响的依赖项目</CardTitle>
            <CardDescription>依赖于变更代码的项目</CardDescription>
          </CardHeader>
          <CardContent>
            {report.result?.affecatedConnections?.length > 0 ? (
              <div className="space-y-2">
                {/* TODO need paginations */}
                {report.result.affecatedConnections.map((conn: any, index: number) => {
                  const fromNodePermalink = generatePermanentLink(conn.fromNode, report.parameters.projectAddr)

                  return (
                    <div
                      key={conn.id || index}
                      className="bg-gray-50 p-3 rounded-md border border-gray-200"
                    >
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">
                          {conn.fromNode?.projectName || '未知'}
                        </span>
                        <span className="text-gray-400 mx-2">→</span>
                        <span className="font-medium text-gray-900">
                          {conn.toNode?.projectName || '未知'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1 flex items-center gap-1 flex-wrap">
                        {fromNodePermalink ? (
                          <a
                            href={fromNodePermalink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline font-mono"
                          >
                            {conn.fromNode?.name}
                          </a>
                        ) : (
                          <span className="font-mono">{conn.fromNode?.name}</span>
                        )}
                        <span className="text-gray-500">({conn.fromNode?.type})</span>
                        <span className="text-gray-400 mx-1">→</span>
                        <span className="font-mono">{conn.toNode?.name}</span>
                        <span className="text-gray-500">({conn.toNode?.type})</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Alert>
                <AlertCircleIcon className="h-4 w-4" />
                <AlertDescription>未发现受影响的依赖连接</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 mt-8">
          <p>
            本报告由{' '}
            <Link href="/" className="hover:underline hover:text-gray-700">
              依赖管理系统 (DMS)
            </Link>{' '}
            生成。
          </p>
        </div>
      </div>
    </div>
  )
}
