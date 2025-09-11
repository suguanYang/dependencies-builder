import Fastify from 'fastify'
import { setupAPI } from './api'
import process from 'node:process'

async function startServer() {
  const fastify = Fastify({
    logger: true,
  })

  try {
    // Setup API routes
    await setupAPI(fastify)
    console.log('API routes registered')

    // Start server
    const port = parseInt(process.env.PORT || '3000')
    const host = process.env.HOST || '0.0.0.0'

    await fastify.listen({ port, host })
    console.log(`Server listening on http://${host}:${port}`)
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...')
    await fastify.close()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...')
    await fastify.close()
    process.exit(0)
  })
}

startServer().catch(console.error)
