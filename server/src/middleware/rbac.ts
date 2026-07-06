import { FastifyRequest, FastifyReply } from 'fastify'
import { PERMISSIONS, ROLES } from '../types'

interface RequiredPermission {
  action: string
  resource: string
}

export function requirePermission(permission: RequiredPermission) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.currentUser

    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'User not authenticated' })
    }

    const userPermissions = PERMISSIONS[user.role] || []

    const hasPermission = userPermissions.some(
      p => p.resource === permission.resource && (p.action === 'manage' || p.action === permission.action)
    )

    if (!hasPermission) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Insufficient permissions' })
    }
  }
}

export function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = request.currentUser

  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'User not authenticated' })
  }

  if (user.role !== ROLES.ADMIN) {
    return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' })
  }
}
