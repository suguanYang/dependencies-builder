import { PrismaClient } from '../generated/prisma'
import { info } from '../logging'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
} & {
  prisma: PrismaClient & {
    $on: (event: string, callback: (event: any) => void) => void
  }
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    }
  ],
})

prisma.$on('query', (e) => {
  info('Query: ' + e.query)
  info('Params: ' + e.params)
  info('Duration: ' + e.duration + 'ms')
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
