import { FastifyInstance } from 'fastify'
import { listFiles, readFile, writeFile, deleteFile, createDirectory, changePermissions, searchFiles, renameFile, downloadFile, uploadFile, compressFile, compressFiles, extractFile } from '../services/files'
import { authenticate } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import path from 'path'
import { logger } from '../core/logger'

export async function filesRoutes(fastify: FastifyInstance) {
  fastify.get('/list', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path: dirPath } = request.query as { path?: string }
      const files = await listFiles(dirPath || '/')
      reply.send(files)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/search', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'files' })] }, async (request, reply) => {
    try {
      const { keyword, path: dirPath, includeSubdirs } = request.query as { keyword: string; path?: string; includeSubdirs?: boolean }
      const files = await searchFiles(dirPath || '/', keyword, includeSubdirs || false)
      reply.send(files)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/read', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path: filePath } = request.query as { path: string }
      const content = await readFile(filePath)
      reply.send({ content })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/download', { preHandler: [authenticate, requirePermission({ action: 'view', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path: filePath } = request.query as { path: string }
      const content = await downloadFile(filePath)
      const fileName = path.basename(filePath)
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`)
      reply.send(content)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/write', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path: filePath, content } = request.body as { path: string; content: string }
      await writeFile(filePath, content)
      reply.send({ message: 'File written successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/upload', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'files' })] }, async (request, reply) => {
    try {
      const data = await request.file()
      if (!data) {
        reply.status(400).send({ error: 'Bad Request', message: 'No file provided' })
        return
      }

      const { path: targetDir, relativePath } = request.query as { path?: string; relativePath?: string }
      const fileName = data.filename
      let targetPath = path.join(targetDir || '/', fileName)
      if (relativePath) {
        targetPath = path.join(targetDir || '/', relativePath, fileName)
      }
      
      const buffer = await data.toBuffer()
      await uploadFile(targetPath, buffer)
      
      reply.send({ message: 'File uploaded successfully', path: targetPath })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/rename', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path: oldPath, newName } = request.body as { path: string; newName: string }
      await renameFile(oldPath, newName)
      reply.send({ message: 'File renamed successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.delete('/delete', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path: filePath } = request.query as { path: string }
      await deleteFile(filePath)
      reply.send({ message: 'File deleted successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/mkdir', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path: dirPath } = request.body as { path: string }
      await createDirectory(dirPath)
      reply.send({ message: 'Directory created successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/chmod', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path: filePath, permissions } = request.body as { path: string; permissions: string }
      await changePermissions(filePath, permissions)
      reply.send({ message: 'Permissions changed successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/compress', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path: filePath, paths } = request.body as { path?: string; paths?: string[] }
      if (paths && paths.length > 0) {
        await compressFiles(paths)
      } else if (filePath) {
        await compressFile(filePath)
      } else {
        reply.status(400).send({ error: 'Bad Request', message: '请提供文件路径' })
        return
      }
      reply.send({ message: 'File compressed successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.post('/extract', { preHandler: [authenticate, requirePermission({ action: 'manage', resource: 'files' })] }, async (request, reply) => {
    try {
      const { path: filePath } = request.body as { path: string }
      logger.info(`Extract request received, path: ${filePath}`)
      logger.info(`Current working directory: ${process.cwd()}`)
      await extractFile(filePath)
      reply.send({ message: 'File extracted successfully' })
    } catch (error: any) {
      logger.error(`Extract error: ${error.message}`)
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })
}
