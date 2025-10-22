import { PrismaClient } from '../dist/generated/prisma/client.js'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Extract project data from unified projects-unified.json
 * This script creates seed data for the Project model
 */
function extractProjectData() {
  const unifiedPath = join(process.cwd(), './prisma/seed/projects.json')
  const projects = JSON.parse(readFileSync(unifiedPath, 'utf-8'))

  return projects
}

/**
 * Seed projects into the database
 */
async function seedProjects() {
  const prisma = new PrismaClient()

  try {
    console.log('Starting project seed...')

    // Extract project data from mapping file
    const projectData = extractProjectData()
    console.log(`Found ${projectData.length} projects to seed`)

    // Use upsert to handle existing projects gracefully
    const upsertPromises = projectData.map(async (project) => {
      return await prisma.project.upsert({
        where: { name: project.name },
        update: {
          addr: project.addr,
          entries: project.entries,
        },
        create: project,
      })
    })

    const results = await Promise.allSettled(upsertPromises)

    const successful = results.filter((result) => result.status === 'fulfilled').length
    const failed = results.filter((result) => result.status === 'rejected').length

    console.log(`Project seed completed: ${successful} projects processed, ${failed} failed`)

    if (failed > 0) {
      const errors = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason)
      console.warn('Some projects failed to seed:', errors)
    }
  } catch (error) {
    console.error('Error seeding projects:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Main function following Prisma seeding pattern
 */
async function main() {
  await seedProjects()
}

main()
  .then(async () => {
    console.log('Seed script completed successfully')
  })
  .catch(async (error) => {
    console.error('Seed script failed:', error)
    process.exit(1)
  })
