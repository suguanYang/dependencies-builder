import { FastifyRequest, FastifyReply } from 'fastify'
import { auth } from '../auth'
import { info } from '../logging'

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string
    email: string
    name?: string
    role?: string
    banned?: boolean
  }
  session?: {
    id: string
    userId: string
    expiresAt: Date
  }
}

/**
 * Authentication middleware that verifies the session token
 */
export async function authenticate(request: AuthenticatedRequest, reply: FastifyReply) {

  try {
    const apiKey = request.headers['dms-key']

    if (typeof apiKey === 'string') {
      info('Api key detected, start validating....')
      const data = await auth.api.verifyApiKey({
        body: {
          key: apiKey,
        },
      });

      if (data.valid) {
        return
      }

      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired apiKey'
      })
    }


    const session = await auth.api.getSession({
      headers: request.headers
    })

    if (!session || !session.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired session'
      })
    }

    // Check if user is banned
    if (session.user.banned) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Your account has been banned'
      })
    }

    // Attach user and session to request
    request.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || undefined,
      role: session.user.role || 'user',
      banned: session.user.banned || false
    }
    request.session = {
      id: session.session.id,
      userId: session.session.userId,
      expiresAt: session.session.expiresAt
    }

  } catch (error) {
    console.error('Authentication error:', error)
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication failed'
    })
  }
}

/**
 * Middleware to require admin role
 */
export async function requireAdmin(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required'
    })
  }

  if (request.user.role !== 'admin') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Admin role required'
    })
  }
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(request: AuthenticatedRequest, _resource: string, action: string): Promise<boolean> {
  if (!request.user) {
    return false
  }

  // For now, we'll use role-based checking instead of the permission API
  // This is simpler and more reliable
  if (request.user.role === 'admin') {
    return true
  }

  // Regular users only have read permissions
  return action === 'read'
}

/**
 * Middleware to require specific permission
 */
export function requirePermission(resource: string, action: string) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required'
      })
    }

    const hasPerm = await hasPermission(request, resource, action)
    if (!hasPerm) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Permission denied: ${action} ${resource}`
      })
    }
  }
}