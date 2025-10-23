#!/usr/bin/env vite-node

/**
 * Batch Action Creation Script
 *
 * This script fetches all projects from the server and creates static analysis actions
 * for each project with branch parameter set to user-specified value. It respects the
 * server's rate limit of 10 concurrent running actions by waiting for batches to complete.
 */

// Configuration
const SERVER_URL = process.env.DMS_SERVER_URL || 'http://127.0.0.1:3001'
const BATCH_SIZE = 10 // Maximum concurrent actions allowed
const POLL_INTERVAL = 5000 // 5 seconds between status checks
const ACTION_TYPE = 'static_analysis' as const

interface Project {
  id: string
  name: string
  addr: string
  type: string
}

interface Action {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  type: string
  parameters: {
    projectAddr?: string
    projectName?: string
    branch?: string
    targetBranch?: string
  }
}

interface ApiResponse<T> {
  data: T[]
  total: number
}

/**
 * Make API request with error handling
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${SERVER_URL}${endpoint}`

  const response = await fetch(url, {
    headers: {
      ...options.headers,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...options,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
    )
  }

  return response.json()
}

/**
 * Fetch all projects from the server API
 */
async function fetchAllProjects(): Promise<Project[]> {
  console.log('Fetching all projects from server...')

  let allProjects: Project[] = []
  let offset = 0
  const limit = 100 // Fetch in pages of 100

  while (true) {
    const response = await apiRequest<ApiResponse<Project>>(
      `/projects?limit=${limit}&offset=${offset}`,
    )

    allProjects = [...allProjects, ...response.data]

    if (response.data.length < limit) {
      break // No more projects
    }

    offset += limit
  }

  console.log(`Found ${allProjects.length} projects`)
  return allProjects
}

/**
 * Create a static analysis action for a project
 */
async function createAction(project: Project, branch: string): Promise<Action> {
  const actionData = {
    type: ACTION_TYPE,
    projectAddr: project.addr,
    projectName: project.name,
    branch: branch,
  }

  const action = await apiRequest<Action>('/actions', {
    method: 'POST',
    body: JSON.stringify(actionData),
  })

  console.log(`Created action ${action.id} for project ${project.name} (branch: ${branch})`)
  return action
}

/**
 * Count currently running actions
 */
async function countRunningActions(): Promise<number> {
  try {
    const response = await apiRequest<ApiResponse<Action>>('/actions')
    const runningActions = response.data.filter((action) => action.status === 'running')
    return runningActions.length
  } catch (err) {
    console.warn('Failed to count running actions:', err)
    return 0
  }
}

/**
 * Wait for running actions to complete
 */
async function waitForRunningActions(): Promise<void> {
  let runningCount = await countRunningActions()

  while (runningCount > 0) {
    console.log(`Waiting for ${runningCount} running actions to complete...`)
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
    runningCount = await countRunningActions()
  }

  console.log('All running actions completed')
}

/**
 * Process projects in batches respecting rate limits
 */
async function processProjectsInBatches(projects: Project[], branch: string): Promise<void> {
  const totalProjects = projects.length
  let processedCount = 0
  let failedCount = 0

  console.log(`Starting batch processing of ${totalProjects} projects (branch: ${branch})`)

  for (let i = 0; i < projects.length; i += BATCH_SIZE) {
    const batch = projects.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(totalProjects / BATCH_SIZE)

    console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} projects)`)

    // Wait for previous batch to complete if needed
    await waitForRunningActions()

    // Create actions for current batch
    const batchPromises = batch.map(async (project) => {
      try {
        await createAction(project, branch)
        processedCount++
        console.log(
          `Progress: ${processedCount}/${totalProjects} (${Math.round((processedCount / totalProjects) * 100)}%)`,
        )
      } catch (err) {
        failedCount++
        console.error(`Failed to create action for project ${project.name}: ${err}`)
      }
    })

    await Promise.all(batchPromises)

    // If this is not the last batch, wait for current batch to start processing
    if (i + BATCH_SIZE < projects.length) {
      console.log('Waiting for current batch to start processing...')
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
    }
  }

  console.log(`Batch processing completed: ${processedCount} successful, ${failedCount} failed`)
}

/**
 * Main function
 */
async function main(branch: string): Promise<void> {
  try {
    console.log(`Starting batch action creation script (branch: ${branch})`)

    // Check if there are any running actions
    const runningCount = await countRunningActions()
    if (runningCount > 0) {
      console.warn(`Found ${runningCount} running actions. Waiting for them to complete...`)
      await waitForRunningActions()
    }

    // Fetch all projects
    const projects = await fetchAllProjects()

    if (projects.length === 0) {
      console.log('No projects found. Nothing to process.')
      return
    }

    // Process projects in batches
    await processProjectsInBatches(projects, branch)

    console.log('Batch action creation completed successfully')
  } catch (err) {
    console.error(`Script failed: ${err}`)
    process.exit(1)
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  // Get branch from command line arguments, default to 'test'
  const branch = process.argv[2] || 'test'

  if (!branch) {
    console.error('Usage: vite-node batch-create-actions.ts [branch]')
    console.error('  branch: The branch to use for all actions (default: test)')
    process.exit(1)
  }

  main(branch).catch((err) => {
    console.error(`Unhandled error: ${err}`)
    process.exit(1)
  })
}
