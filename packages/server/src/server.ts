import Fastify, { FastifyBaseLogger } from 'fastify'
import cors from '@fastify/cors'
import { setupAPI } from './api'
import process from 'node:process'
import logger from './logging'

export default async () => {
  const fastify = Fastify({
    loggerInstance: logger as FastifyBaseLogger,
  })

  // Setup CORS
  await fastify.register(cors, {
    origin: process.env.CLIENT_DOMAIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400,
  })

  // Setup API routes
  await setupAPI(fastify)

  // Start connection scheduler polling
  const { ConnectionScheduler } = await import('./services/scheduler')
  ConnectionScheduler.getInstance().startPolling()

  return fastify
}
