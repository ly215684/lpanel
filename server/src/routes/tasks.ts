import { FastifyInstance } from 'fastify'
import { getTasks, getTask, createTask, updateTask, deleteTask, runTask, getTaskExecutions } from '../services/tasks'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { CreateTaskRequest } from '../types'

export async function tasksRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'tasks' })] }, async (request, reply) => {
    try {
      const tasks = await getTasks()
      reply.send(tasks)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/:id', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'tasks' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const task = await getTask(id)
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' })
      }
      reply.send(task)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'tasks' })] }, async (request, reply) => {
    try {
      const data = request.body as CreateTaskRequest
      const task = await createTask(data)
      reply.status(201).send(task)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.put('/:id', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'tasks' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const data = request.body as Partial<{ name: string; cron_expression: string; command?: string; status: string }>
      const task = await updateTask(id, data)
      reply.send(task)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.delete('/:id', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'tasks' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await deleteTask(id)
      reply.send({ message: 'Task deleted successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/:id/run', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'tasks' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await runTask(id)
      reply.send({ message: 'Task started successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/:id/executions', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'tasks' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const executions = await getTaskExecutions(id)
      reply.send(executions)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })
}
