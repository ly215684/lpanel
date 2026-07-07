import { FastifyInstance } from 'fastify'
import { getImages, pullImage, removeImage, getContainers, createContainer, startContainer, stopContainer, removeContainer, getContainerLogs, listDirectory, readComposeFile, composeUp, composeDown, composeLogs } from '../services/containers'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { executeShellCommand } from '../core/command'

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

  fastify.get('/compose/directory', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'containers' })] }, async (request, reply) => {
    try {
      const { path } = request.query as { path: string }
      const items = await listDirectory(path || '/')
      reply.send(items)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/compose/file', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'containers' })] }, async (request, reply) => {
    try {
      const { path } = request.query as { path: string }
      const content = await readComposeFile(path)
      reply.send({ content })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/compose/up', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'containers' })] }, async (request, reply) => {
    try {
      const { path, content } = request.body as { path?: string; content?: string }
      if (content) {
        await executeShellCommand(`echo "${content.replace(/"/g, '\\"')}" > /tmp/docker-compose-temp.yml`)
        await composeUp('/tmp/docker-compose-temp.yml')
      } else if (path) {
        await composeUp(path)
      }
      reply.send({ message: 'Compose services started successfully' })
    } catch (error: any) {
      const message = error.message || '启动失败'
      let errorType = 'unknown'
      let userMessage = message

      if (message.includes('no such file or directory') || message.includes('Cannot find the file') || message.includes('does not exist')) {
        errorType = 'file_not_found'
        userMessage = '文件不存在或路径错误'
      } else if (message.includes('Permission denied') || message.includes('permission denied')) {
        errorType = 'permission_denied'
        userMessage = '权限不足，请检查文件或目录权限'
      } else if (message.includes('docker: not found') || message.includes('command not found')) {
        errorType = 'docker_not_installed'
        userMessage = 'Docker 未安装或未正确配置'
      } else if (message.includes('compose') && (message.includes('not found') || message.includes('has no attribute'))) {
        errorType = 'compose_not_installed'
        userMessage = 'Docker Compose 未安装，请先安装 Compose'
      } else if (message.includes('port') && (message.includes('already in use') || message.includes('bind: address already in use'))) {
        errorType = 'port_conflict'
        userMessage = '端口冲突，该端口已被占用'
      } else if (message.includes('invalid reference format') || message.includes('pull access denied')) {
        errorType = 'image_error'
        userMessage = '镜像拉取失败或镜像名称无效'
      } else if (message.includes('yaml') || message.includes('YAML')) {
        errorType = 'yaml_error'
        userMessage = 'YAML 配置文件格式错误'
      }

      reply.status(500).send({ error: errorType, message: userMessage, detail: message })
    }
  })

  fastify.post('/compose/down', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'containers' })] }, async (request, reply) => {
    try {
      const { path } = request.body as { path: string }
      await composeDown(path)
      reply.send({ message: 'Compose services stopped successfully' })
    } catch (error: any) {
      const message = error.message || '停止失败'
      let errorType = 'unknown'
      let userMessage = message

      if (message.includes('Permission denied') || message.includes('permission denied')) {
        errorType = 'permission_denied'
        userMessage = '权限不足，请检查文件或目录权限'
      } else if (message.includes('docker: not found') || message.includes('command not found')) {
        errorType = 'docker_not_installed'
        userMessage = 'Docker 未安装或未正确配置'
      } else if (message.includes('compose') && (message.includes('not found') || message.includes('has no attribute'))) {
        errorType = 'compose_not_installed'
        userMessage = 'Docker Compose 未安装，请先安装 Compose'
      }

      reply.status(500).send({ error: errorType, message: userMessage, detail: message })
    }
  })

  fastify.get('/compose/logs', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'containers' })] }, async (request, reply) => {
    try {
      const { path } = request.query as { path: string }
      const logs = await composeLogs(path)
      reply.send({ logs })
    } catch (error: any) {
      const message = error.message || '获取日志失败'
      let errorType = 'unknown'
      let userMessage = message

      if (message.includes('Permission denied') || message.includes('permission denied')) {
        errorType = 'permission_denied'
        userMessage = '权限不足，请检查文件或目录权限'
      } else if (message.includes('docker: not found') || message.includes('command not found')) {
        errorType = 'docker_not_installed'
        userMessage = 'Docker 未安装或未正确配置'
      }

      reply.status(500).send({ error: errorType, message: userMessage, detail: message })
    }
  })
}
