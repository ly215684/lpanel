import { PrismaClient } from '@prisma/client'
import { hashPassword, verifyPassword, generateRefreshToken } from '../core/security'
import { logger } from '../core/logger'

const prisma = new PrismaClient()

export async function login(username: string, password: string, ipAddress: string) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: username },
        { email: username }
      ],
      status: true
    }
  })

  if (!user) {
    throw new Error('Invalid credentials')
  }

  const isPasswordValid = await verifyPassword(password, user.password_hash)
  if (!isPasswordValid) {
    throw new Error('Invalid credentials')
  }

  const refreshToken = generateRefreshToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      user_id: user.id,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      ip_address: ipAddress
    }
  })

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at
    },
    refreshToken
  }
}

export async function refreshToken(refreshToken: string) {
  const session = await prisma.session.findFirst({
    where: { refresh_token: refreshToken },
    include: { user: true }
  })

  if (!session) {
    throw new Error('Invalid refresh token')
  }

  if (session.expires_at < new Date()) {
    await prisma.session.delete({ where: { id: session.id } })
    throw new Error('Refresh token expired')
  }

  const newRefreshToken = generateRefreshToken()
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refresh_token: newRefreshToken,
      expires_at: newExpiresAt
    }
  })

  return {
    user: {
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      role: session.user.role,
      status: session.user.status,
      created_at: session.user.created_at,
      updated_at: session.user.updated_at
    },
    refreshToken: newRefreshToken
  }
}

export async function logout(refreshToken: string) {
  const session = await prisma.session.findFirst({
    where: { refresh_token: refreshToken }
  })
  if (session) {
    await prisma.session.delete({ where: { id: session.id } })
  }
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      created_at: true,
      updated_at: true
    }
  })

  return user
}

export async function createUser(data: { username: string; email: string; password: string; role?: string }) {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username: data.username },
        { email: data.email }
      ]
    }
  })

  if (existingUser) {
    throw new Error('Username or email already exists')
  }

  const passwordHash = await hashPassword(data.password)

  const user = await prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      password_hash: passwordHash,
      role: data.role || 'user',
      status: true
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      created_at: true,
      updated_at: true
    }
  })

  return user
}

export async function initAdmin() {
  const adminExists = await prisma.user.findFirst({
    where: { role: 'admin' }
  })

  if (!adminExists) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
    const passwordHash = await hashPassword(adminPassword)
    await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@localhost',
        password_hash: passwordHash,
        role: 'admin',
        status: true
      }
    })
    logger.info('Default admin user created')
  }
}
