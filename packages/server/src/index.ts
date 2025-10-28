import process from 'node:process'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from './app.module'
import logger, { info } from './logging'
import { PrismaService } from './database/prisma.service'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger,
    }),
    {
      bodyParser: false,
    },
  )

  // Enable CORS
  app.enableCors({
    origin: process.env.CLIENT_DOMAIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400,
  })

  // Get PrismaService for graceful shutdown
  const prismaService = app.get(PrismaService)

  const port = parseInt(process.env.PORT || '3001')
  const host = process.env.HOST || '0.0.0.0'

  await app.listen(port, host)
  info(`NestJS server running on ${host}:${port}`)

  // Graceful shutdown
  process.on('SIGINT', async () => {
    info('Shutting down gracefully...')
    await prismaService.$disconnect()
    await app.close()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    info('Shutting down gracefully...')
    await prismaService.$disconnect()
    await app.close()
    process.exit(0)
  })

  // @ts-ignore
  if (import.meta.hot) {
    // @ts-ignore
    import.meta.hot.on('vite:beforeFullReload', async () => {
      await prismaService.$disconnect()
      await app.close()
    })
  }
}

bootstrap()
