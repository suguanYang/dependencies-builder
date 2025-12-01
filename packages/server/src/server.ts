import Fastify, { FastifyBaseLogger } from 'fastify'
import cors from '@fastify/cors'
import { setupAPI } from './api'
import process from 'node:process'
import logger, { info } from './logging'

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
  info('CORS configured')

  // Setup API routes
  await setupAPI(fastify)
  info('API routes registered')

  return fastify
}
