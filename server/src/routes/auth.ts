import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { login, refreshToken, logout, getUserById, updateUser, changePassword } from '../services/auth'
import { authenticate } from '../middleware/auth'
import { LoginRequest, RefreshTokenRequest } from '../types'

const prisma = new PrismaClient()

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: LoginRequest }>('/login', async (request, reply) => {
    try {
      const { username, password } = request.body
      const ipAddress = request.ip || ''
      
      const { user, refreshToken: refreshTokenValue, sessionId } = await login(username, password, ipAddress)
      
      const accessToken = await reply.jwtSign({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      })
      
      const accessTokenExpires = new Date(Date.now() + 60 * 60 * 1000)
      
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          access_token: accessToken,
          access_token_expires: accessTokenExpires
        }
      })
      
      reply.send({
        access_token: accessToken,
        refresh_token: refreshTokenValue,
        user
      })
    } catch (error: any) {
      reply.status(401).send({ error: 'Unauthorized', message: error.message })
    }
  })

  fastify.post<{ Body: RefreshTokenRequest }>('/refresh', async (request, reply) => {
    try {
      const { refresh_token } = request.body
      
      const { user, refreshToken: refreshTokenValue, sessionId } = await refreshToken(refresh_token)
      
      const accessToken = await reply.jwtSign({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      })
      
      const accessTokenExpires = new Date(Date.now() + 60 * 60 * 1000)
      
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          access_token: accessToken,
          access_token_expires: accessTokenExpires
        }
      })
      
      reply.send({
        access_token: accessToken,
        refresh_token: refreshTokenValue,
        user
      })
    } catch (error: any) {
      reply.status(401).send({ error: 'Unauthorized', message: error.message })
    }
  })

  fastify.post<{ Body: RefreshTokenRequest }>('/logout', async (request, reply) => {
    try {
      const { refresh_token } = request.body
      await logout(refresh_token)
      reply.send({ message: 'Logged out successfully' })
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.get('/me', { preHandler: authenticate }, async (request, reply) => {
    try {
      const user = await getUserById(request.currentUser!.id)
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }
      reply.send(user)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.put('/me', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { username, email, currentPassword } = request.body as { username?: string; email?: string; currentPassword: string }
      const user = await updateUser(request.currentUser!.id, { username, email, currentPassword })
      reply.send(user)
    } catch (error: any) {
      reply.status(400).send({ error: 'Bad Request', message: error.message })
    }
  })

  fastify.post('/me/password', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string }
      const result = await changePassword(request.currentUser!.id, currentPassword, newPassword)
      reply.send(result)
    } catch (error: any) {
      reply.status(400).send({ error: 'Bad Request', message: error.message })
    }
  })
}
