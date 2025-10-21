import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load projects mapping from JSON file
const projectsMapping = JSON.parse(
    readFileSync(join(__dirname, 'projects-name-mapping.json'), 'utf-8')
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

// Function to generate all project-package combinations
function generateProjectPackageCombinations() {
    const combinations = []

    // Process each project
    for (const [projectName, projectData] of Object.entries(projectsMapping.projects)) {
        const projectUrl = projectData.url.replace(/\s+/g, '') // Remove spaces from URLs

        // Get package names for this project
        const packageNames = projectsMapping.packageNames[projectName] || {}

        // If no specific packages, create one entry for the project itself
        if (Object.keys(packageNames).length === 0) {
            combinations.push({
                projectName,
                projectUrl,
                uploadOss: true,
                appNames: []
            })
        } else {
            // Create entries for each package
            for (const [packageName, packageData] of Object.entries(packageNames)) {
                combinations.push({
                    projectName,
                    projectUrl,
                    packageName,
                })
            }
        }
    }

    return combinations
}

// Function to create an action for a single project-package combination
async function createAction(combination) {
    const actionData = {
        type: ACTION_TYPE,
        projectUrl: combination.projectUrl,
        branch: BRANCH,
        name: combination.packageName
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
        console.log(`✓ Created action for ${combination.projectName}/${combination.packageName} (ID: ${result.id})`)
        return {
            success: true,
            project: combination.projectName,
            packageName: combination.packageName,
            actionId: result.id
        }
    } catch (error) {
        console.error(`✗ Failed to create action for ${combination.projectName}/${combination.packageName}: ${error.message}`)
        return {
            success: false,
            project: combination.projectName,
            packageName: combination.packageName,
            error: error.message
        }
    }
}

// Function to process combinations in batches
async function processInBatches(combinations, batchSize) {
    const results = {
        success: [],
        failed: []
    }

    for (let i = 0; i < combinations.length; i += batchSize) {
        const batch = combinations.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(combinations.length / batchSize)

        console.log(`\n[Batch ${batchNumber}/${totalBatches}] Processing ${batch.length} project-package combinations...`)

        // Process batch concurrently
        const batchResults = await Promise.all(
            batch.map(combination => createAction(combination))
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
        if (i + batchSize < combinations.length) {
            console.log(`Waiting ${DELAY_MS}ms before next batch...`)
            await sleep(DELAY_MS)
        }
    }

    return results
}

// Function to filter combinations based on criteria
function filterCombinations(combinations, filters = {}) {
    let filtered = combinations

    // Filter by project name pattern
    if (filters.projectPattern) {
        const pattern = new RegExp(filters.projectPattern, 'i')
        filtered = filtered.filter(c => pattern.test(c.projectName))
    }

    // Filter by package name pattern
    if (filters.packagePattern) {
        const pattern = new RegExp(filters.packagePattern, 'i')
        filtered = filtered.filter(c => pattern.test(c.packageName))
    }

    // Filter by uploadOss status
    if (filters.uploadOss !== undefined) {
        filtered = filtered.filter(c => c.uploadOss === filters.uploadOss)
    }

    // Filter by appNames (only include packages that have specific app names)
    if (filters.hasAppNames) {
        filtered = filtered.filter(c => c.appNames && c.appNames.length > 0)
    }

    return filtered
}

// Main execution
async function main() {
    console.log('='.repeat(80))
    console.log('Monorepo Batch Actions Script')
    console.log('='.repeat(80))
    console.log(`API Base URL: ${API_BASE_URL}`)
    console.log(`Action Type: ${ACTION_TYPE}`)
    console.log(`Branch: ${BRANCH}`)
    console.log(`Batch Size: ${BATCH_SIZE}`)

    // Generate all combinations
    const allCombinations = generateProjectPackageCombinations()
    console.log(`Total Project-Package Combinations: ${allCombinations.length}`)

    const combinations = allCombinations
    console.log(`Total Combinations: ${combinations.length}`)


    console.log('='.repeat(80))

    if (combinations.length === 0) {
        console.log('No combinations match the current filters.')
        return
    }

    const startTime = Date.now()

    const results = await processInBatches(combinations, BATCH_SIZE)

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    console.log('\n' + '='.repeat(80))
    console.log('Summary')
    console.log('='.repeat(80))
    console.log(`Total Combinations: ${combinations.length}`)
    console.log(`Successful: ${results.success.length}`)
    console.log(`Failed: ${results.failed.length}`)
    console.log(`Duration: ${duration}s`)

    if (results.failed.length > 0) {
        console.log('\nFailed Combinations:')
        results.failed.forEach(({ project, packageName, error }) => {
            console.log(`  - ${project}/${packageName}: ${error}`)
        })
    }

    // Show some successful examples
    if (results.success.length > 0) {
        console.log('\nSample Successful Combinations:')
        results.success.slice(0, 5).forEach(({ project, packageName, actionId }) => {
            console.log(`  - ${project}/${packageName} (ID: ${actionId})`)
        })
        if (results.success.length > 5) {
            console.log(`  ... and ${results.success.length - 5} more`)
        }
    }

    console.log('='.repeat(80))

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
