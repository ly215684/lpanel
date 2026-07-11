import { FastifyInstance } from 'fastify'
import { installDocker, installDockerCompose, checkDockerStatus, startDocker, getAllServicesStatus, installNginx, installApache, installPHP, installMySQL, startNginx, startApache, startPHP, startMySQL, uninstallDocker, uninstallNginx, uninstallApache, uninstallPHP, uninstallMySQL, getDockerConfig, saveDockerConfig, getNginxConfig, saveNginxConfig, getApacheConfig, saveApacheConfig, getPHPConfig, savePHPConfig, getMySQLConfig, saveMySQLConfig, stopService, type InstallationResult } from '../services/system'
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

  fastify.post('/docker/start', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    reply.type('text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')

    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`)
    }

    try {
      await startDocker(sendEvent)
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: true, message: 'Docker 启动成功' })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: false, message: error.message })}\n\n`)
      reply.raw.end()
    }
  })

  fastify.post('/nginx/start', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await startNginx()
      reply.send({ message: 'Nginx started successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/apache/start', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await startApache()
      reply.send({ message: 'Apache started successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/php/start', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await startPHP()
      reply.send({ message: 'PHP started successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/mysql/start', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await startMySQL()
      reply.send({ message: 'MySQL started successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/docker/stop', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await stopService('docker')
      reply.send({ message: 'Docker stopped successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/nginx/stop', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await stopService('nginx')
      reply.send({ message: 'Nginx stopped successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/apache/stop', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await stopService('apache2')
      reply.send({ message: 'Apache stopped successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/php/stop', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await stopService('php8.3-fpm')
      reply.send({ message: 'PHP stopped successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/mysql/stop', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      await stopService('mysql')
      reply.send({ message: 'MySQL stopped successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/docker/uninstall', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    reply.type('text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')

    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`)
    }

    try {
      await uninstallDocker(sendEvent)
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: true, message: 'Docker 卸载完成' })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: false, message: error.message })}\n\n`)
      reply.raw.end()
    }
  })

  fastify.post('/nginx/uninstall', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    reply.type('text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')

    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`)
    }

    try {
      await uninstallNginx(sendEvent)
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: true, message: 'Nginx 卸载完成' })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: false, message: error.message })}\n\n`)
      reply.raw.end()
    }
  })

  fastify.post('/apache/uninstall', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    reply.type('text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')

    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`)
    }

    try {
      await uninstallApache(sendEvent)
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: true, message: 'Apache 卸载完成' })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: false, message: error.message })}\n\n`)
      reply.raw.end()
    }
  })

  fastify.post('/php/uninstall', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    reply.type('text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')

    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`)
    }

    try {
      await uninstallPHP(sendEvent)
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: true, message: 'PHP 卸载完成' })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: false, message: error.message })}\n\n`)
      reply.raw.end()
    }
  })

  fastify.post('/mysql/uninstall', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    reply.type('text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')

    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ log: data })}\n\n`)
    }

    try {
      await uninstallMySQL(sendEvent)
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: true, message: 'MySQL 卸载完成' })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ done: true, success: false, message: error.message })}\n\n`)
      reply.raw.end()
    }
  })

  fastify.get('/docker/config', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'system' })] }, async (request, reply) => {
    try {
      const config = await getDockerConfig()
      reply.send(config)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/docker/config', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      const { content } = request.body as { content: string }
      await saveDockerConfig(content)
      reply.send({ message: 'Docker config saved successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/nginx/config', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'system' })] }, async (request, reply) => {
    try {
      const config = await getNginxConfig()
      reply.send(config)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/nginx/config', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      const { content } = request.body as { content: string }
      await saveNginxConfig(content)
      reply.send({ message: 'Nginx config saved successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/apache/config', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'system' })] }, async (request, reply) => {
    try {
      const config = await getApacheConfig()
      reply.send(config)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/apache/config', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      const { content } = request.body as { content: string }
      await saveApacheConfig(content)
      reply.send({ message: 'Apache config saved successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/php/config', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'system' })] }, async (request, reply) => {
    try {
      const config = await getPHPConfig()
      reply.send(config)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/php/config', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      const { content } = request.body as { content: string }
      await savePHPConfig(content)
      reply.send({ message: 'PHP config saved successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/mysql/config', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'system' })] }, async (request, reply) => {
    try {
      const config = await getMySQLConfig()
      reply.send(config)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/mysql/config', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'system' })] }, async (request, reply) => {
    try {
      const { content } = request.body as { content: string }
      await saveMySQLConfig(content)
      reply.send({ message: 'MySQL config saved successfully' })
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