'use client'

import useSWR, { SWRConfig } from 'swr'
import { getProjectById, getAllProjectDependencies, DependencyGraph } from '@/lib/api'
import { swrConfig } from '@/lib/swr-config'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Box, GitBranch, Folder } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CyclesList, Cycle } from '@/components/cycles-list'
import React, { useMemo } from 'react'
import { useParams } from 'next/navigation'

const fetcher = (branch: string) => getAllProjectDependencies(branch)

function CyclesLoader({ projectId }: { projectId: string }) {
    // Fetch global graph
    const { data: graphs, error, isLoading } = useSWR(
        ['all-project-dependencies', 'test'],
        () => fetcher('test')
    )

    const cycles = useMemo(() => {
        // getAllProjectDependencies returns an array of graphs (one per worker maybe? Or implementation detail in api.ts types?)
        // Wait, api.ts says `getAllProjectDependencies` returns `Promise<DependencyGraph[]>`. 
        // Let's verify result structure. Usually it's a single graph for the whole workspace if using *?
        // Ah, `getProjectLevelDependencyGraph` (server) returns a single string (JSON).
        // `dependenciesRoutes` sends it directly.
        // `api.ts` types might be wrong or I need to handle array.
        // Let's check api.ts line 532: `Promise<DependencyGraph[]>`.
        // Server sends `graphJson` which is `DependencyGraph` object. 
        // So `api.ts` likely expects a single object for `*`?
        // Wait, `getProjectLevelDependencyGraph` implementation returns ONE graph. 
        // Why `api.ts` returns `DependencyGraph[]`?
        // Let's look at api.ts again.
        // Line 533: `apiRequest(...)`. If endpoint returns object, it's object.
        // I will assume it returns `DependencyGraph` (singular) based on server code.
        // I'll cast it if needed.

        if (!graphs) return []
        const graph = Array.isArray(graphs) ? graphs[0] : (graphs as any as DependencyGraph)

        if (!graph?.cycles) return []

        // Filter cycles:
        // 1. Must involve current projectId
        // 2. Length > 1 (exclude self-loops if just A->A, although A->A has length 2 in struct [A,A])
        // 3. Rotate so projectId is first
        const relevantCycles: Cycle[] = []

        for (const c of graph.cycles) {
            // Check if involved
            const index = c.findIndex(node => node.id === projectId)
            if (index === -1) continue

            // Backend returns closed loop [A, B, C, A]. length 4.
            // If self loop [A, A], length 2. User asked to filter out self loops? "filter out the projects iteself's cycles"
            // Usually means internal cycles. [A, A] is definitely internal.
            if (c.length <= 2) continue

            // Rotate
            // Remove last element (it's duplicate of first)
            const openCycle = c.slice(0, c.length - 1)

            // Re-find index in open cycle (should be same unless it was the last element, which matches first)
            // But FindCycles logic ensures starts with min index or DFS entry.
            // Safe to find index again.
            const pIndex = openCycle.findIndex(node => node.id === projectId)

            if (pIndex === -1) continue // Should not happen

            // [A, B, C]. Target B (idx 1).
            // part1: [B, C] (slice 1)
            // part2: [A] (slice 0, 1)
            // new: [B, C, A]
            const rotated = [
                ...openCycle.slice(pIndex),
                ...openCycle.slice(0, pIndex)
            ]

            // Close it
            rotated.push(rotated[0])

            // Filter: All nodes must be Lib. If any is App, ignore.
            // Note: rotated array includes start/end duplicate.
            if (rotated.some(node => node.type === 'App')) continue

            relevantCycles.push(rotated as any as Cycle)
        }

        return relevantCycles
    }, [graphs, projectId])

    return <CyclesList cycles={cycles} isLoading={isLoading} error={error} projectId={projectId} height={800} itemHeight={80} />
}

export default function ProjectDetailPage() {
    const params = useParams()
    const id = params?.id as string

    if (!id) return null

    return (
        <SWRConfig value={swrConfig}>
            <ProjectDetailContent projectId={id} />
        </SWRConfig>
    )
}

function ProjectDetailContent({ projectId }: { projectId: string }) {
    const { data: project, error: projectError } = useSWR(
        ['project', projectId],
        () => getProjectById(projectId)
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
                <div className="flex flex-col gap-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                                <Box className="w-8 h-8" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                                <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                                    <Badge variant="outline" className="font-normal">
                                        {project.type}
                                    </Badge>
                                    <span>•</span>
                                    <div className="flex items-center gap-1.5 font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">
                                        <Folder className="w-3.5 h-3.5" />
                                        {project.addr}
                                    </div>

                                </div>
                            </div>
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

                    <CyclesLoader projectId={projectId} />
                </div>
            </div>
        </div>
    )
}
