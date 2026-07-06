import { FastifyInstance } from 'fastify'
import { installDocker, installDockerCompose, checkDockerStatus, getAllServicesStatus, installNginx, installApache, installPHP, installMySQL } from '../services/system'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

export async function systemRoutes(fastify: FastifyInstance) {
  fastify.get('/services', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'system' })] }, async (request, reply) => {
    try {
      const services = await getAllServicesStatus()
      reply.send(services)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/docker/status', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'system' })] }, async (request, reply) => {
    try {
      const status = await checkDockerStatus()
      reply.send(status)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/docker/install', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await installDocker()
      reply.send({ message: 'Docker installed successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Installation Failed', message: error.message })
    }
  })

  fastify.post('/docker/compose/install', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await installDockerCompose()
      reply.send({ message: 'Docker Compose installed successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Installation Failed', message: error.message })
    }
  })

  fastify.post('/nginx/install', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await installNginx()
      reply.send({ message: 'Nginx installed successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Installation Failed', message: error.message })
    }
  })

  fastify.post('/apache/install', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await installApache()
      reply.send({ message: 'Apache installed successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Installation Failed', message: error.message })
    }
  })

  fastify.post('/php/install', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      const { version } = request.body as { version?: string }
      await installPHP(version || '8.3')
      reply.send({ message: `PHP ${version || '8.3'} installed successfully` })
    } catch (error: any) {
      reply.status(500).send({ error: 'Installation Failed', message: error.message })
    }
  })

  fastify.post('/mysql/install', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await installMySQL()
      reply.send({ message: 'MySQL installed successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Installation Failed', message: error.message })
    }
  })
}