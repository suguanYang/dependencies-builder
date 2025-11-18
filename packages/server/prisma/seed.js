import { PrismaClient } from '../dist/generated/prisma/client.js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { auth } from '../dist/auth.js'

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
 * Create admin user using Better Auth
 */
async function seedAdminUser() {
  const prisma = new PrismaClient()

  try {
    console.log('Creating admin user...')

    // Check if admin user already exists using Prisma directly
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@gg.com' },
    })

    if (existingUser) {
      console.log('Admin user already exists, updating role to admin...')

      // Update existing user to admin role
      await prisma.user.update({
        where: { email: 'admin@gg.com' },
        data: { role: 'admin' },
      })

      console.log('Admin user role updated successfully')
      return
    }

    // Create new admin user using Better Auth
    const result = await auth.api.signUpEmail({
      body: {
        email: 'admin@gg.com',
        password: 'admin123',
        name: 'Admin User',
      },
    })

    if (result.user) {
      console.log('Admin user created successfully')

      // Set admin role for the new user
      await prisma.user.update({
        where: { email: 'admin@gg.com' },
        data: { role: 'admin' },
      })

      console.log('Admin role assigned successfully')
    } else {
      console.error('Failed to create admin user:', result.error)
    }
  } catch (error) {
    console.error('Error creating admin user:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
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
  await seedAdminUser()
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
