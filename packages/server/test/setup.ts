import { afterAll } from 'vitest'
import { prisma } from '../src/database/prisma'

afterAll(async () => {
  await prisma.$disconnect()
})
