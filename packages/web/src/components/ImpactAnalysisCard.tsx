import { AlertCircleIcon, BadgeCheckIcon, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { ImpactReport } from '@/lib/server-types'

interface ImpactAnalysisCardProps {
  impactAnalysis?: ImpactReport | null
  className?: string
}

/**
 * Displays LLM-generated impact analysis results
 * Shows severity level, impact summary, suggestions, and additional details
 */
export function ImpactAnalysisCard({ impactAnalysis, className = '' }: ImpactAnalysisCardProps) {
  if (!impactAnalysis) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gray-400" />
            AI Impact Analysis
          </CardTitle>
          <CardDescription>No AI analysis available for this report</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Analysis Not Available</AlertTitle>
            <AlertDescription>
              This report was generated without LLM impact analysis. To enable AI-powered insights,
              configure the required environment variables in the CLI.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const StatusIcon = impactAnalysis.success ? BadgeCheckIcon : AlertCircleIcon

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI Impact Analysis
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <StatusIcon className="h-4 w-4" />
          {impactAnalysis.success
            ? 'Analysis completed successfully'
            : 'Analysis encountered issues'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Change Summary */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Code Changes Summary</h4>
          <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
            <ul className="list-disc list-inside space-y-1">
              {impactAnalysis.summary.map((change, index) => (
                <li key={index}>{change}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Per-Project Impacts */}
        {impactAnalysis.affectedProjects && impactAnalysis.affectedProjects.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Affected Projects</h4>
            <div className="space-y-3">
              {impactAnalysis.affectedProjects.map((project, index) => {
                // Determine colors based on project level
                const getProjectColors = (level: string) => {
                  switch (level) {
                    case 'safe':
                      return 'bg-blue-50 border-blue-200 text-blue-900'
                    case 'low':
                      return 'bg-green-50 border-green-200 text-green-900'
                    case 'medium':
                      return 'bg-yellow-50 border-yellow-200 text-yellow-900'
                    case 'high':
                      return 'bg-red-50 border-red-200 text-red-900'
                    default:
                      return 'bg-gray-50 border-gray-200 text-gray-900'
                  }
                }

                const projectColors = getProjectColors(project.level)

                return (
                  <div key={index} className={`p-3 rounded-md border ${projectColors}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-sm">{project.projectName}</h5>
                      <span className="text-xs font-semibold uppercase">{project.level}</span>
                    </div>
                    {project.impacts && project.impacts.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-semibold mb-1">Impacts:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          {project.impacts.map((impact, iidx) => (
                            <li key={iidx}>{impact}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {project.suggestions && project.suggestions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1">Suggestions:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          {project.suggestions.map((suggestion, sidx) => (
                            <li key={sidx}>{suggestion || '无'}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Additional Message */}
        {impactAnalysis.message && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 list-none">
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 transition-transform group-open:rotate-90"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
                Additional Details
              </span>
            </summary>
            <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
              {impactAnalysis.message}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
