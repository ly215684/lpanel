import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { Server } from 'socket.io'
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
import { setupMonitorSocket } from './sockets/monitor'

async function main() {
  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL as any,
      transport: {
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

  await fastify.listen({ port: env.PORT, host: env.HOST })

  const io = new Server(fastify.server, {
    cors: {
      origin: '*'
    }
  })

  setupMonitorSocket(io)

  await initAdmin()
  await initTasks()

  logger.info(`Server listening on http://${env.HOST}:${env.PORT}`)
}

main().catch(error => {
  logger.error('Server startup failed:', error)
  process.exit(1)
})
