'use client'

import useSWR, { SWRConfig } from 'swr'
import { getProjectById, getProjectDependencies } from '@/lib/api'
import { swrConfig } from '@/lib/swr-config'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Box, GitBranch, Folder } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
    const { id } = await params
    return (
        <SWRConfig value={swrConfig}>
            <ProjectDetailContent projectId={id} />
        </SWRConfig>
    )
}

function ProjectDetailContent({ projectId }: { projectId: string }) {
    const { data: project, error: projectError } = useSWR(
        ['project', projectId],
        () => {
            return getProjectById(projectId);
        }
    )


    if (projectError) {
        return (
            <div className="p-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        Failed to load project: {projectError.message}
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    if (!project) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50/30">
            {/* Header */}
            <div className="border-b bg-white px-8 py-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                        <Box className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <div className="flex items-center gap-1.5 font-mono">
                                <Folder className="w-4 h-4" />
                                {project.addr}
                            </div>
                            <div className="h-1 w-1 rounded-full bg-gray-300" />
                            <Badge variant="secondary">{project.type}</Badge>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto p-8 space-y-8">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            Circular Dependencies
                        </h2>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                    </div>
                </div>
            </div>
        </div>
    )
}
