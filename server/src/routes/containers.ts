import { FastifyInstance } from 'fastify'
import { getImages, pullImage, removeImage, getContainers, createContainer, startContainer, stopContainer, removeContainer, getContainerLogs } from '../services/containers'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

export async function containersRoutes(fastify: FastifyInstance) {
  fastify.get('/images', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'containers' })] }, async (request, reply) => {
    try {
      const images = await getImages()
      reply.send(images)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/images/pull', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'containers' })] }, async (request, reply) => {
    try {
      const { imageName } = request.body as { imageName: string }
      await pullImage(imageName)
      reply.send({ message: 'Image pulled successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.delete('/images/:id', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'containers' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await removeImage(id)
      reply.send({ message: 'Image removed successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'containers' })] }, async (request, reply) => {
    try {
      const { all } = request.query as { all?: boolean }
      const containers = await getContainers(all || false)
      reply.send(containers)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'containers' })] }, async (request, reply) => {
    try {
      const data = request.body as { image: string; name: string; ports?: string[]; env?: string[]; command?: string }
      const containerId = await createContainer(data)
      reply.status(201).send({ id: containerId })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/:id/start', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'containers' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await startContainer(id)
      reply.send({ message: 'Container started successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/:id/stop', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'containers' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await stopContainer(id)
      reply.send({ message: 'Container stopped successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.delete('/:id', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'containers' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await removeContainer(id)
      reply.send({ message: 'Container removed successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/:id/logs', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'containers' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { tail } = request.query as { tail?: number }
      const logs = await getContainerLogs(id, tail || 100)
      reply.send({ logs })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })
}
