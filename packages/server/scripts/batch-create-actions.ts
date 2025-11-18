#!/usr/bin/env vite-node

/**
 * Batch Action Creation Script
 *
 * This script fetches all projects from the server and creates static analysis actions
 * for each project with branch parameter set to user-specified value. It respects the
 * server's rate limit of 10 concurrent running actions by continuously feeding new
 * actions as slots become available.
 */

// Configuration
const SERVER_URL = process.env.DMS_SERVER_URL || 'http://10.101.64.161:3001'
const MAX_CONCURRENT_ACTIONS = 10 // Maximum concurrent actions allowed by server
const POLL_INTERVAL = 2000 // 2 seconds between status checks (reduced for better responsiveness)
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
    ...options,
    headers: {
      ...options.headers,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
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
    headers: {
      'dms-key': key,
    },
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
 * Wait for available action slots
 */
async function waitForAvailableSlots(): Promise<void> {
  let runningCount = await countRunningActions()

  while (runningCount >= MAX_CONCURRENT_ACTIONS) {
    console.log(
      `Waiting for available slots (${runningCount}/${MAX_CONCURRENT_ACTIONS} running)...`,
    )
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
    runningCount = await countRunningActions()
  }
}

/**
 * Process projects continuously respecting rate limits
 */
async function processProjectsContinuously(projects: Project[], branch: string): Promise<void> {
  const totalProjects = projects.length
  let processedCount = 0
  let failedCount = 0

  console.log(`Starting continuous processing of ${totalProjects} projects (branch: ${branch})`)
  console.log(`Maximum concurrent actions: ${MAX_CONCURRENT_ACTIONS}`)

  // Process all projects with continuous pipeline
  for (const project of projects) {
    // Wait for available slots before creating new action
    await waitForAvailableSlots()

    // Create action for current project
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
  }

  console.log(
    `Continuous processing completed: ${processedCount} successful, ${failedCount} failed`,
  )
}

/**
 * Main function
 */
async function main(branch: string): Promise<void> {
  try {
    console.log(`Starting batch action creation script (branch: ${branch})`)

    // Check if there are any running actions
    const runningCount = await countRunningActions()
    if (runningCount >= MAX_CONCURRENT_ACTIONS) {
      console.warn(
        `Found ${runningCount} running actions (max: ${MAX_CONCURRENT_ACTIONS}). Waiting for available slots...`,
      )
      await waitForAvailableSlots()
    }

    // Fetch all projects
    const projects = await fetchAllProjects()

    if (projects.length === 0) {
      console.log('No projects found. Nothing to process.')
      return
    }

    // Process projects continuously
    await processProjectsContinuously(projects, branch)

    console.log('Batch action creation completed successfully')
  } catch (err) {
    console.error(`Script failed: ${err}`)
    process.exit(1)
  }
}

// Run the script
// Get branch from command line arguments, default to 'test'
const branch = process.argv[2] || 'test'
const key = process.argv[3] || 'null'

if (!branch) {
  console.error('Usage: vite-node batch-create-actions.ts [branch]')
  console.error('  branch: The branch to use for all actions (default: test)')
  process.exit(1)
}

main(branch).catch((err) => {
  console.error(`Unhandled error: ${err}`)
  process.exit(1)
})
