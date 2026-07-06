import { FastifyInstance } from 'fastify'
import { getSystemInfo, getCPUInfo, getMemoryInfo, getDiskInfo, getNetworkInfo, getAllMonitorData } from '../services/monitor'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

export async function monitorRoutes(fastify: FastifyInstance) {
  fastify.get('/system', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'monitor' })] }, async (request, reply) => {
    try {
      const info = await getSystemInfo()
      reply.send(info)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/cpu', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'monitor' })] }, async (request, reply) => {
    try {
      const info = await getCPUInfo()
      reply.send(info)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/memory', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'monitor' })] }, async (request, reply) => {
    try {
      const info = await getMemoryInfo()
      reply.send(info)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/disk', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'monitor' })] }, async (request, reply) => {
    try {
      const info = await getDiskInfo()
      reply.send(info)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/network', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'monitor' })] }, async (request, reply) => {
    try {
      const info = await getNetworkInfo()
      reply.send(info)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/all', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'monitor' })] }, async (request, reply) => {
    try {
      const data = await getAllMonitorData()
      reply.send(data)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })
}
