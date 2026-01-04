import { afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// Determine worker ID. In Vitest, process.env.VITEST_WORKER_ID is available.
const workerId = process.env.VITEST_WORKER_ID || 'main'

const DB_FOLDER = path.resolve(__dirname, '.test-dbs')
const TEMPLATE_DB = path.join(DB_FOLDER, 'dms.db')

// Unique name for this worker's DB
const TARGET_DB_NAME = `test-${workerId}-${randomUUID().substring(0, 8)}.db`

const TARGET_DB_PATH = path.join(DB_FOLDER, TARGET_DB_NAME)

// Copy template to worker-specific DB inside the folder
try {
  if (fs.existsSync(TEMPLATE_DB)) {
    fs.copyFileSync(TEMPLATE_DB, TARGET_DB_PATH)

    // Set the environment variable for Prisma to use this new DB
    process.env.DATABASE_URL = `file:${TARGET_DB_PATH}`
  } else {
    throw new Error(`Template DB not found at ${TEMPLATE_DB}.`)
  }
} catch (e) {
  console.error('Failed to setup test database environment:', e)
  throw e
}

afterAll(async () => {
  import('../src/database/prisma').then(({ prisma }) => {
    prisma.$disconnect()
  })
})
