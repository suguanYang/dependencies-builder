import Fastify, { FastifyBaseLogger } from 'fastify'
import cors from '@fastify/cors'
import { setupAPI } from './api'
import process from 'node:process'
import logger, { fatal, info } from './logging'
import { prisma } from './database/prisma'

async function startServer() {
  const fastify = Fastify({
    loggerInstance: logger as FastifyBaseLogger,
  })

  try {
    // Setup CORS
    await fastify.register(cors, {
      origin: process.env.CLIENT_DOMAIN,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With"
      ],
      credentials: true,
      maxAge: 86400
    })
    info('CORS configured')

    // Setup API routes
    await setupAPI(fastify)
    info('API routes registered')

    // Start server
    const port = parseInt(process.env.PORT || '3001')
    const host = process.env.HOST || '0.0.0.0'

    await fastify.listen({ port, host })
  } catch (error) {
    fatal(error, 'Failed to start server')
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

  // @ts-ignore
  if (import.meta.hot) {
    // @ts-ignore
    import.meta.hot.on('vite:beforeFullReload', async () => {
      await prisma.$disconnect()
      await fastify.close()
    })
  }
}

startServer()
