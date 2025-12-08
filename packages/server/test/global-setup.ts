import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const DB_FOLDER = path.resolve(__dirname, '.test-dbs')
const TEMPLATE_DB = path.join(DB_FOLDER, 'dms.db')

export async function setup() {
    console.log('Global Setup: Creating template database...')

    // Create or clean the dedicated folder
    if (fs.existsSync(DB_FOLDER)) {
        // Clean up existing files
        fs.rmSync(DB_FOLDER, { recursive: true, force: true })
    }
    fs.mkdirSync(DB_FOLDER)

    // Create the template database by running migrations
    try {

        // We need to use a distinct environment variable for the template generation
        // to match what Prisma expects.
        const dbUrl = `file:${TEMPLATE_DB}`

        execSync('npx prisma db push', {
            env: {
                ...process.env,
                DATABASE_URL: dbUrl
            },
            stdio: 'inherit',
            cwd: path.resolve(__dirname, '..') // Ensure we run from package root
        })
        console.log('Global Setup: Template database created.')
    } catch (error) {
        console.error('Global Setup: Failed to create template database.')
        throw error
    }
}

export async function teardown() {
    console.log('Global Setup: Cleaning up all test databases...')
    if (fs.existsSync(DB_FOLDER)) {
        fs.rmSync(DB_FOLDER, { recursive: true, force: true })
    }
    console.log('Global Setup: Cleanup complete.')
}
