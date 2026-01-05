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

    // Determine severity colors based on level
    const getSeverityColors = (level: string) => {
        switch (level) {
            case 'low':
                return {
                    badge: 'bg-green-100 text-green-700 border-green-300',
                    border: 'border-green-200',
                }
            case 'medium':
                return {
                    badge: 'bg-yellow-100 text-yellow-700 border-yellow-300',
                    border: 'border-yellow-200',
                }
            case 'high':
                return {
                    badge: 'bg-red-100 text-red-700 border-red-300',
                    border: 'border-red-200',
                }
            default:
                return {
                    badge: 'bg-gray-100 text-gray-700 border-gray-300',
                    border: 'border-gray-200',
                }
        }
    }

    const colors = getSeverityColors(impactAnalysis.level)
    const StatusIcon = impactAnalysis.success ? BadgeCheckIcon : AlertCircleIcon

    return (
        <Card className={`${className} border-2 ${colors.border}`}>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        AI Impact Analysis
                    </span>
                    <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${colors.badge}`}
                    >
                        {impactAnalysis.level.toUpperCase()} SEVERITY
                    </span>
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                    <StatusIcon className="h-4 w-4" />
                    {impactAnalysis.success ? 'Analysis completed successfully' : 'Analysis encountered issues'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Impact Summary */}
                <div>
                    <h4 className="font-semibold text-sm mb-2">Business Impact</h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                        {impactAnalysis.impaction}
                    </p>
                </div>

                {/* Suggestions */}
                <div>
                    <h4 className="font-semibold text-sm mb-2">Recommendations</h4>
                    <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-md border border-blue-200">
                        {impactAnalysis.suggestion}
                    </p>
                </div>

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
