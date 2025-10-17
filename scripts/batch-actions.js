import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load projects from JSON file
const projects = JSON.parse(
    readFileSync(join(__dirname, 'projects.json'), 'utf-8')
)

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001'
const ACTION_TYPE = process.env.ACTION_TYPE || 'static_analysis' // Options: 'static_analysis', 'report', 'connection_auto_create'
const BRANCH = process.env.BRANCH || 'master'
const BATCH_SIZE = 5 // Number of concurrent requests
const DELAY_MS = 2000 // Delay between batches in milliseconds

// Utility function to sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// Function to create an action for a single project
async function createAction(project) {
    const actionData = {
        type: ACTION_TYPE,
        project: project.url,
        branch: BRANCH,
        name: project.name
    }

    try {
        const response = await fetch(`${API_BASE_URL}/actions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(actionData)
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`)
        }

        const result = await response.json()
        console.log(`✓ Created action for ${project.name} (ID: ${result.id})`)
        return { success: true, project: project.name, actionId: result.id }
    } catch (error) {
        console.error(`✗ Failed to create action for ${project.name}: ${error.message}`)
        return { success: false, project: project.name, error: error.message }
    }
}

// Function to process projects in batches
async function processInBatches(projects, batchSize) {
    const results = {
        success: [],
        failed: []
    }

    for (let i = 0; i < projects.length; i += batchSize) {
        const batch = projects.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(projects.length / batchSize)

        console.log(`\n[Batch ${batchNumber}/${totalBatches}] Processing ${batch.length} projects...`)

        // Process batch concurrently
        const batchResults = await Promise.all(
            batch.map(project => createAction(project))
        )

        // Collect results
        batchResults.forEach(result => {
            if (result.success) {
                results.success.push(result)
            } else {
                results.failed.push(result)
            }
        })

        // Wait before next batch (except for the last batch)
        if (i + batchSize < projects.length) {
            console.log(`Waiting ${DELAY_MS}ms before next batch...`)
            await sleep(DELAY_MS)
        }
    }

    return results
}

// Main execution
async function main() {
    console.log('='.repeat(60))
    console.log('Batch Actions Script')
    console.log('='.repeat(60))
    console.log(`API Base URL: ${API_BASE_URL}`)
    console.log(`Action Type: ${ACTION_TYPE}`)
    console.log(`Branch: ${BRANCH}`)
    console.log(`Total Projects: ${projects.length}`)
    console.log(`Batch Size: ${BATCH_SIZE}`)
    console.log('='.repeat(60))

    const startTime = Date.now()

    const results = await processInBatches(projects, BATCH_SIZE)

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    console.log('\n' + '='.repeat(60))
    console.log('Summary')
    console.log('='.repeat(60))
    console.log(`Total Projects: ${projects.length}`)
    console.log(`Successful: ${results.success.length}`)
    console.log(`Failed: ${results.failed.length}`)
    console.log(`Duration: ${duration}s`)

    if (results.failed.length > 0) {
        console.log('\nFailed Projects:')
        results.failed.forEach(({ project, error }) => {
            console.log(`  - ${project}: ${error}`)
        })
    }

    console.log('='.repeat(60))

    // Exit with error code if any failed
    if (results.failed.length > 0) {
        process.exit(1)
    }
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})
