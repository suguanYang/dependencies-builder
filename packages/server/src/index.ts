import Fastify, { FastifyBaseLogger } from 'fastify'
import { setupAPI } from './api'
import process from 'node:process'
import logger, { fatal, info } from './logging'
import { prisma } from './database/prisma';

async function startServer() {
  const fastify = Fastify({
    loggerInstance: logger as FastifyBaseLogger,
    logger: {
      msgPrefix: 'dms-server',
    }
  });

  try {
    // Setup API routes
    await setupAPI(fastify)
    info('API routes registered')

    // Start server
    const port = parseInt(process.env.PORT || '3000')
    const host = process.env.HOST || '0.0.0.0'

    await fastify.listen({ port, host })
  } catch (error) {
    fatal(error, "Failed to start server")
    process.exit(1)
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    info('Shutting down gracefully...')
    await prisma.$disconnect()
    await fastify.close()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    info('Shutting down gracefully...')
    await prisma.$disconnect()
    await fastify.close()
    process.exit(0)
  })
}

startServer()
