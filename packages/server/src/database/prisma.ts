import { PrismaClient } from '../generated/prisma/client'
import { error, info } from '../logging'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
} & {
  prisma: PrismaClient & {
    $on: (event: string, callback: (event: any) => void) => void
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

prisma.$on('error', (e) => {
  error('prisma Error: ' + e.message)
})

prisma.$on('warn', (e) => {
  info('prisma Warn: ' + e.message)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
