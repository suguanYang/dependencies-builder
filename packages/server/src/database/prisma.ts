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

const prismaClient = new PrismaClient({ adapter })

export const prisma = globalForPrisma.prisma ?? prismaClient.$extends({
  query: {
    node: {
      async create({ args, query }) {
        const result = await query(args)
        // Trigger auto-create connection scheduler
        import('../services/scheduler').then(({ ConnectionScheduler }) => {
          ConnectionScheduler.getInstance().scheduleConnectionAutoCreate(false)
        })
        return result
      },
      async update({ args, query }) {
        const result = await query(args)
        import('../services/scheduler').then(({ ConnectionScheduler }) => {
          ConnectionScheduler.getInstance().scheduleConnectionAutoCreate(false)
        })
        return result
      },
      async delete({ args, query }) {
        const result = await query(args)
        import('../services/scheduler').then(({ ConnectionScheduler }) => {
          ConnectionScheduler.getInstance().scheduleConnectionAutoCreate(false)
        })
        return result
      },
      async createMany({ args, query }) {
        const result = await query(args)
        import('../services/scheduler').then(({ ConnectionScheduler }) => {
          ConnectionScheduler.getInstance().scheduleConnectionAutoCreate(false)
        })
        return result
      },
      async updateMany({ args, query }) {
        const result = await query(args)
        import('../services/scheduler').then(({ ConnectionScheduler }) => {
          ConnectionScheduler.getInstance().scheduleConnectionAutoCreate(false)
        })
        return result
      },
      async deleteMany({ args, query }) {
        const result = await query(args)
        import('../services/scheduler').then(({ ConnectionScheduler }) => {
          ConnectionScheduler.getInstance().scheduleConnectionAutoCreate(false)
        })
        return result
      },
      async upsert({ args, query }) {
        const result = await query(args)
        import('../services/scheduler').then(({ ConnectionScheduler }) => {
          ConnectionScheduler.getInstance().scheduleConnectionAutoCreate(false)
        })
        return result
      },
    },
  },
}) as unknown as PrismaClient

prisma.$on('error', (e) => {
  error('prisma Error: ' + e.message)
})

prisma.$on('warn', (e) => {
  info('prisma Warn: ' + e.message)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
