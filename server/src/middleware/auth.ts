import { FastifyRequest, FastifyReply } from 'fastify'
import { logger } from '../core/logger'

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: {
      id: string
      username: string
      email: string
      role: string
    }
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'No token provided' })
    }

    const decoded = await request.jwtVerify<{ id: string; username: string; email: string; role: string }>()
    request.currentUser = decoded

    return decoded
  } catch (error) {
    logger.error(`Authentication failed: ${error}`)
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token' })
  }
}
