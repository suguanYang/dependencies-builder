import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../database/prisma'
import { setTimeout } from 'timers/promises'

describe('SQLite Update Hook (Native)', () => {
  let projectId: string

  beforeEach(async () => {
    // Clear actions to ensure a clean state
    await prisma.action.deleteMany()
    await prisma.node.deleteMany()
    await prisma.project.deleteMany()

    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        addr: 'test-addr',
        type: 'App',
      },
    })
    projectId = project.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })
})
