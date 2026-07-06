import { FastifyInstance } from 'fastify'
import { createWebsite, getWebsites, getWebsite, updateWebsite, deleteWebsite, enableSSL, restartWebServer } from '../services/websites'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { CreateWebsiteRequest } from '../types'

export async function websitesRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'websites' })] }, async (request, reply) => {
    try {
      const websites = await getWebsites()
      reply.send(websites)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/:id', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'websites' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const website = await getWebsite(id)
      if (!website) {
        return reply.status(404).send({ error: 'Website not found' })
      }
      reply.send(website)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'websites' })] }, async (request, reply) => {
    try {
      const data = request.body as CreateWebsiteRequest
      const website = await createWebsite(data)
      reply.status(201).send(website)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.put('/:id', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'websites' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const data = request.body as Partial<{ name: string; domain: string; ssl_enabled: boolean }>
      const website = await updateWebsite(id, data)
      reply.send(website)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.delete('/:id', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'websites' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await deleteWebsite(id)
      reply.send({ message: 'Website deleted successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/:id/enable-ssl', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'websites' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const website = await enableSSL(id)
      reply.send(website)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/restart', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'websites' })] }, async (request, reply) => {
    try {
      const { webServer } = request.body as { webServer: string }
      await restartWebServer(webServer)
      reply.send({ message: 'Web server restarted successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })
}
