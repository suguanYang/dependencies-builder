import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'
import { error, info } from '../logging'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
} & {
  prisma: PrismaClient & {
    $on: (event: string, callback: (event: any) => void) => void
  }
}

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter })

prisma.$on('error', (e) => {
  error('prisma Error: ' + e.message)
})

prisma.$on('warn', (e) => {
  info('prisma Warn: ' + e.message)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
