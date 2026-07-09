import { FastifyRequest, FastifyReply } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { logger } from '../core/logger'

const prisma = new PrismaClient()

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

    const session = await prisma.session.findFirst({
      where: {
        user_id: decoded.id,
        access_token: token,
        access_token_expires: {
          gt: new Date()
        }
      }
    })

    if (!session) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Token has been revoked or expired' })
    }

    return decoded
  } catch (error) {
    logger.error(`Authentication failed: ${error}`)
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token' })
  }
}
