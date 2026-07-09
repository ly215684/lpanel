import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { Server } from 'socket.io'
import path from 'path'
import { env } from './config'
import { logger } from './core/logger'
import { initAdmin } from './services/auth'
import { initTasks } from './services/tasks'
import { authRoutes } from './routes/auth'
import { monitorRoutes } from './routes/monitor'
import { filesRoutes } from './routes/files'
import { websitesRoutes } from './routes/websites'
import { databasesRoutes } from './routes/databases'
import { containersRoutes } from './routes/containers'
import { tasksRoutes } from './routes/tasks'
import { systemRoutes } from './routes/system'
import settingsRoutes from './routes/settings'
import { setupMonitorSocket } from './sockets/monitor'

async function main() {
  const isProduction = process.env.NODE_ENV === 'production'
  
  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL as any,
      transport: isProduction ? undefined : {
        target: 'pino-pretty'
      }
    }
  })

  await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })

  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN
    }
  })

  await fastify.register(multipart)

  await fastify.register(authRoutes, { prefix: '/api/auth' })
  await fastify.register(monitorRoutes, { prefix: '/api/monitor' })
  await fastify.register(filesRoutes, { prefix: '/api/files' })
  await fastify.register(websitesRoutes, { prefix: '/api/websites' })
  await fastify.register(databasesRoutes, { prefix: '/api/databases' })
  await fastify.register(containersRoutes, { prefix: '/api/containers' })
  await fastify.register(tasksRoutes, { prefix: '/api/tasks' })
  await fastify.register(systemRoutes, { prefix: '/api/system' })
  await fastify.register(settingsRoutes, { prefix: '/api/settings' })

  const publicDir = path.join(__dirname, '..', 'public')
  await fastify.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
    wildcard: false
  })

  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not Found', message: `Route ${request.method}:${request.url} not found` })
    }
    return reply.sendFile('index.html')
  })

  await initAdmin().catch(err => {
    logger.error('Failed to initialize admin user:', err)
  })
  await initTasks().catch(err => {
    logger.error('Failed to initialize tasks:', err)
  })

  await fastify.listen({ port: env.PORT, host: env.HOST })

  const io = new Server(fastify.server, {
    cors: {
      origin: '*'
    }
  })

  setupMonitorSocket(io)

  logger.info(`Server listening on http://${env.HOST}:${env.PORT}`)
}

main().catch(error => {
  logger.error('Server startup failed:', error)
  process.exit(1)
})
