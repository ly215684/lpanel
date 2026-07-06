import { FastifyInstance } from 'fastify'
import { listFiles, readFile, writeFile, deleteFile, createDirectory, changePermissions } from '../services/files'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

export async function filesRoutes(fastify: FastifyInstance) {
  fastify.get('/list', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path } = request.query as { path?: string }
      const files = await listFiles(path || '/var/www')
      reply.send(files)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/read', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path } = request.query as { path: string }
      const content = await readFile(path)
      reply.send({ content })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/write', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path, content } = request.body as { path: string; content: string }
      await writeFile(path, content)
      reply.send({ message: 'File written successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.delete('/delete', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path } = request.query as { path: string }
      await deleteFile(path)
      reply.send({ message: 'File deleted successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/mkdir', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path } = request.body as { path: string }
      await createDirectory(path)
      reply.send({ message: 'Directory created successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/chmod', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path, permissions } = request.body as { path: string; permissions: string }
      await changePermissions(path, permissions)
      reply.send({ message: 'Permissions changed successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })
}
