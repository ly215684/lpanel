import { FastifyInstance } from 'fastify'
import { installDocker, installDockerCompose, checkDockerStatus, getAllServicesStatus, installNginx, installApache, installPHP, installMySQL, type InstallationResult } from '../services/system'
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
    const { mirror } = request.body as { mirror?: 'official' | 'aliyun' | 'daocloud' }
    
    reply.type('text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')
    
    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`)
    }
    
    try {
      const result = await installDocker(mirror || 'official', sendEvent)
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: result.success, message: result.message })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: false, message: error.message })}\n\n`)
      reply.raw.end()
    }
  })

  fastify.post('/docker/compose/install', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    reply.type('text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')
    
    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`)
    }
    
    try {
      const result = await installDockerCompose(sendEvent)
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: result.success, message: result.message })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: false, message: error.message })}\n\n`)
      reply.raw.end()
    }
  })

  fastify.post('/nginx/install', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    reply.type('text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')
    
    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`)
    }
    
    try {
      const result = await installNginx(sendEvent)
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: result.success, message: result.message })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: false, message: error.message })}\n\n`)
      reply.raw.end()
    }
  })

  fastify.post('/apache/install', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    reply.type('text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')
    
    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`)
    }
    
    try {
      const result = await installApache(sendEvent)
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: result.success, message: result.message })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: false, message: error.message })}\n\n`)
      reply.raw.end()
    }
  })

  fastify.post('/php/install', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    const { version } = request.body as { version?: string }
    
    reply.type('text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')
    
    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`)
    }
    
    try {
      const result = await installPHP(version || '8.3', sendEvent)
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: result.success, message: result.message })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: false, message: error.message })}\n\n`)
      reply.raw.end()
    }
  })

  fastify.post('/mysql/install', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    reply.type('text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')
    
    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`)
    }
    
    try {
      const result = await installMySQL(sendEvent)
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: result.success, message: result.message })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: false, message: error.message })}\n\n`)
      reply.raw.end()
    }
  })
}