import { beforeAll, afterAll } from 'vitest'
import { execSync } from 'child_process'
import { prisma } from '../src/database/prisma'
import path from 'path'

// Global test setup - runs before all tests
beforeAll(async () => {
  // Ensure we are using the test database
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl || !dbUrl.includes('test.db')) {
    throw new Error('Test database URL must include "test.db" to prevent accidental data loss')
  }

  // Run migrations/push to setup the schema
  try {
    console.log('Setting up test database...')
    execSync('npx prisma db push', {
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: 'inherit',
    })
    console.log('Test database setup complete.')
  } catch (error) {
    console.error('Failed to setup test database:', error)
    throw error
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})
