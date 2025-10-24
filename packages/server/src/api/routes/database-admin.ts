import { FastifyInstance } from 'fastify'
import { prisma } from '../../database/prisma'
import { authenticate, requireAdmin } from '../../auth/middleware'

interface DatabaseQueryRequest {
  query: string
}

interface DatabaseQueryResult {
  success: boolean
  data?: any[]
  error?: string
  executionTime?: number
  rowCount?: number
}

// Helper function to convert BigInt values to Number for JSON serialization
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'bigint') {
    return Number(obj)
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber)
  }

  if (typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertBigIntToNumber(value)
    }
    return result
  }

  return obj
}

function databaseAdminRoutes(fastify: FastifyInstance) {
  // POST /database-admin/query - Execute raw SQL query
  fastify.post('/database-admin/query', {
    preHandler: [authenticate, requireAdmin]
  }, async (request, reply) => {
    try {
      const { query } = request.body as DatabaseQueryRequest

      if (!query || query.trim() === '') {
        reply.code(400).send({
          error: 'Query is required',
        })
        return
      }

      // Basic safety check - prevent destructive operations
      const trimmedQuery = query.trim().toLowerCase()

      // Allow SELECT queries and basic introspection
      // const isSafeQuery =
      //   trimmedQuery.startsWith('select') ||
      //   trimmedQuery.startsWith('pragma') ||
      //   trimmedQuery.startsWith('explain query plan')

      // if (!isSafeQuery) {
      //   reply.code(403).send({
      //     error: 'Only SELECT, PRAGMA, and EXPLAIN QUERY PLAN queries are allowed for safety reasons',
      //   })
      //   return
      // }

      const startTime = Date.now()

      try {
        // Execute the raw query using Prisma's $queryRaw
        const result = await prisma.$queryRawUnsafe(query)
        const executionTime = Date.now() - startTime

        // Convert result to array format for consistent response
        const rawData = Array.isArray(result) ? result : [result]

        // Convert BigInt values to Number for JSON serialization
        const data = convertBigIntToNumber(rawData)

        const response: DatabaseQueryResult = {
          success: true,
          data,
          executionTime,
          rowCount: data.length,
        }

        return response
      } catch (dbError) {
        const executionTime = Date.now() - startTime
        const response: DatabaseQueryResult = {
          success: false,
          error: dbError instanceof Error ? dbError.message : 'Database error occurred',
          executionTime,
        }
        return response
      }

    } catch (error) {
      reply.code(500).send({
        error: 'Failed to execute database query',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // GET /database-admin/schema - Get database schema information
  fastify.get('/database-admin/schema', {
    preHandler: [authenticate, requireAdmin]
  }, async (_request, reply) => {
    try {
      // Get table information
      const tables = await prisma.$queryRaw`
        SELECT
          name as tableName,
          sql
        FROM
          sqlite_master
        WHERE
          type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY
          name
      `

      // Get table row counts and convert BigInt to Number
      const tableCounts = await Promise.all(
        (tables as any[]).map(async (table: any) => {
          const countResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table.tableName}`)
          const rowCount = (countResult as any)[0].count
          return {
            tableName: table.tableName,
            rowCount: Number(rowCount), // Convert BigInt to Number
          }
        })
      )

      return {
        tables: (tables as any[]).map((table, index) => ({
          ...table,
          rowCount: tableCounts[index]?.rowCount || 0,
        })),
      }
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to fetch database schema',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // GET /database-admin/tables/:tableName - Get table structure
  fastify.get('/database-admin/tables/:tableName', {
    preHandler: [authenticate, requireAdmin]
  }, async (request, reply) => {
    try {
      const { tableName } = request.params as { tableName: string }

      // Get table schema
      const rawSchema = await prisma.$queryRawUnsafe(`PRAGMA table_info(${tableName})`)

      // Get sample data (first 10 rows)
      const rawSampleData = await prisma.$queryRawUnsafe(`SELECT * FROM ${tableName} LIMIT 10`)

      // Convert BigInt values to Number for JSON serialization
      const schema = convertBigIntToNumber(rawSchema)
      const sampleData = convertBigIntToNumber(rawSampleData)

      return {
        tableName,
        schema,
        sampleData,
      }
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to fetch table information',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}

export default databaseAdminRoutes