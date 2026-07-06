import { FastifyInstance } from 'fastify'
import { login, refreshToken, logout, getUserById } from '../services/auth'
import { authenticate } from '../middleware/auth'
import { LoginRequest, RefreshTokenRequest } from '../types'

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: LoginRequest }>('/login', async (request, reply) => {
    try {
      const { username, password } = request.body
      const ipAddress = request.ip || ''
      
      const { user, refreshToken: refreshTokenValue } = await login(username, password, ipAddress)
      
      const accessToken = await reply.jwtSign({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
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
      
      const { user, refreshToken: refreshTokenValue } = await refreshToken(refresh_token)
      
      const accessToken = await reply.jwtSign({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
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
}
