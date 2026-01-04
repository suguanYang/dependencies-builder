'use client'

import useSWR, { SWRConfig } from 'swr'
import { getProjectById, getAllProjectDependencies } from '@/lib/api'
import { swrConfig } from '@/lib/swr-config'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Box, Folder, GitBranch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CyclesList, Cycle } from '@/components/cycles-list'
import React, { useMemo, Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function ProjectDetailContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  // Branch state management
  const [branchInput, setBranchInput] = useState('test')
  const [selectedBranch, setSelectedBranch] = useState('test')

  const { data: project, error: projectError } = useSWR(id ? ['project', id] : null, () =>
    getProjectById(id!),
  )

  const {
    data: graphs,
    error: graphsError,
    isLoading: graphsLoading,
    mutate,
  } = useSWR(['all-project-dependencies', selectedBranch], () => getAllProjectDependencies(selectedBranch))

  const handleApplyBranch = () => {
    setSelectedBranch(branchInput)
    // Mutate will revalidate the data with the new branch
    mutate()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleApplyBranch()
    }
  }

  const cycles = useMemo(() => {
    if (!graphs || !id) return []
    const cycles = graphs.map((g) => g.cycles).flat()

    // Filter cycles:
    // 1. Must involve current projectId
    // 2. Length > 1 (exclude self-loops if just A->A, although A->A has length 2 in struct [A,A])
    // 3. Rotate so projectId is first
    const relevantCycles: Cycle[] = []

    for (const c of cycles) {
      if (!c) continue

      // Check if involved
      const index = c.findIndex((node) => node.id === id)
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
      const pIndex = openCycle.findIndex((node) => node.id === id)

      if (pIndex === -1) continue // Should not happen

      // [A, B, C]. Target B (idx 1).
      // part1: [B, C] (slice 1)
      // part2: [A] (slice 0, 1)
      // new: [B, C, A]
      const rotated = [...openCycle.slice(pIndex), ...openCycle.slice(0, pIndex)]

      // Close it
      rotated.push(rotated[0])

      // Filter: All nodes must be Lib. If any is App, ignore.
      // Note: rotated array includes start/end duplicate.
      if (rotated.some((node) => node.type === 'App')) continue

      relevantCycles.push(rotated as Cycle)
    }

    return relevantCycles
  }, [graphs, id])

  if (!id) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>No project ID provided</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (projectError) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load project: {projectError.message}</AlertDescription>
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

          {/* Branch Input Section */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <GitBranch className="w-4 h-4 text-gray-500" />
              <span className="font-medium">Branch:</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={branchInput}
                onChange={(e) => setBranchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter branch name"
                className="w-64 h-9 text-sm"
              />
              <Button
                onClick={handleApplyBranch}
                size="sm"
                className="h-9"
                disabled={!branchInput || branchInput === selectedBranch}
              >
                Apply
              </Button>
              {selectedBranch && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {selectedBranch}
                </Badge>
              )}
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

          <CyclesList
            cycles={cycles}
            isLoading={graphsLoading}
            error={graphsError}
            projectId={id}
            height={800}
            itemHeight={80}
          />
        </div>
      </div>
    </div>
  )
}

export default function ProjectDetailPage() {
  return (
    <SWRConfig value={swrConfig}>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }
      >
        <ProjectDetailContent />
      </Suspense>
    </SWRConfig>
  )
}
