import { FastifyInstance } from 'fastify'
import { getDatabases, getDatabase, createDatabase, deleteDatabase, backupDatabase, getBackups, restoreDatabase } from '../services/databases'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { CreateDatabaseRequest } from '../types'

export async function databasesRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'databases' })] }, async (request, reply) => {
    try {
      const databases = await getDatabases()
      reply.send(databases)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/:id', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'databases' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const database = await getDatabase(id)
      if (!database) {
        return reply.status(404).send({ error: 'Database not found' })
      }
      reply.send(database)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'databases' })] }, async (request, reply) => {
    try {
      const data = request.body as CreateDatabaseRequest
      const database = await createDatabase(data)
      reply.status(201).send(database)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.delete('/:id', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'databases' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await deleteDatabase(id)
      reply.send({ message: 'Database deleted successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/:id/backup', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'databases' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const backup = await backupDatabase(id)
      reply.status(201).send(backup)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/:id/backups', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'databases' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const backups = await getBackups(id)
      reply.send(backups)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/:id/restore', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'databases' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { backupPath } = request.body as { backupPath: string }
      await restoreDatabase(id, backupPath)
      reply.send({ message: 'Database restored successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })
}
