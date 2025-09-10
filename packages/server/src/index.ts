import Fastify from 'fastify';
import { DatabaseManager } from './database/manager';
import { setupAPI } from './api';
import process from 'node:process';

async function startServer() {
  const fastify = Fastify({
    logger: true
  });

  // Initialize database manager
  const dbManager = DatabaseManager.getInstance({
    path: process.env.DB_PATH || './dms.db',
    memory: process.env.DB_MEMORY === 'true'
  });

  try {
    // Connect to database
    await dbManager.connect();
    console.log('Database connected successfully');

    // Setup API routes
    await setupAPI(fastify, dbManager);
    console.log('API routes registered');

    // Start server
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await fastify.close();
    await dbManager.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await fastify.close();
    await dbManager.disconnect();
    process.exit(0);
  });
}

startServer().catch(console.error);