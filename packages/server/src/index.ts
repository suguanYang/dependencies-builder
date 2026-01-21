import process from 'node:process'
import { fatal, info } from './logging'
import { prisma } from './database/prisma'
import server from './server'
import { FastifyInstance } from 'fastify'
import { mcpServerService } from './services/mcp-server'

async function startServer() {
  let fastify: FastifyInstance
  try {
    fastify = await server()

    // Start server
    const port = parseInt(process.env.PORT || '3001')
    const host = process.env.HOST || '0.0.0.0'

    await fastify.listen({ port, host })

    // Start MCP server after main server is running
    try {
      await mcpServerService.start()
    } catch (error) {
      // Log but don't crash - MCP is optional
      fatal(error, 'Failed to start MCP server (LLM features will be unavailable)')
    }
  } catch (error) {
    fatal(error, 'Failed to start server')
    process.exit(1)
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    info('Shutting down gracefully...')
    await fastify.close()
    await prisma.$disconnect()
    await mcpServerService.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    info('Shutting down gracefully...')
    await fastify.close()
    await prisma.$disconnect()
    await mcpServerService.stop()
    process.exit(0)
  })

  // @ts-ignore
  if (import.meta.hot) {
    // @ts-ignore
    import.meta.hot.on('vite:beforeFullReload', async () => {
      await mcpServerService.stop()
      await fastify.close()
      await prisma.$disconnect()
    })
  }
}

startServer()
