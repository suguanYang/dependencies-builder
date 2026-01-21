import Fastify, { FastifyBaseLogger } from 'fastify'
import cors from '@fastify/cors'
import { setupAPI } from './api'
import process from 'node:process'
import logger from './logging'
import zlib from 'node:zlib'

export default async () => {
  const fastify = Fastify({
    loggerInstance: logger as FastifyBaseLogger,
  })

  // Add custom parser for gzip support
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    if (req.headers['content-encoding'] === 'gzip') {
      zlib.gunzip(body, (err, decoded) => {
        if (err) return done(err)
        try {
          const json = JSON.parse(decoded.toString())
          done(null, json)
        } catch (e) {
          done(e as Error)
        }
      })
    } else {
      try {
        const json = JSON.parse(body.toString())
        done(null, json)
      } catch (e) {
        done(e as Error)
      }
    }
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

  return fastify
}
