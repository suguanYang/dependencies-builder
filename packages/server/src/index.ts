import Fastify, { FastifyBaseLogger } from 'fastify'
import cors from '@fastify/cors'
import { setupAPI } from './api'
import process from 'node:process'
import logger, { fatal, info } from './logging'
import { prisma } from './database/prisma'
import server from './server'

async function startServer() {
  try {
    const fastify = await server()

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
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    info('Shutting down gracefully...')
    await prisma.$disconnect()
    process.exit(0)
  })

  // @ts-ignore
  if (import.meta.hot) {
    // @ts-ignore
    import.meta.hot.on('vite:beforeFullReload', async () => {
      await prisma.$disconnect()
    })
  }
}
startServer()