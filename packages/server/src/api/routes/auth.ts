import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { auth } from '../../auth'
import { authenticate, AuthenticatedRequest } from '../../auth/middleware'

// Helper function to convert Fastify request to standard Request object
function createRequestFromFastify(request: FastifyRequest): Request {
  const url = `${request.protocol}://${request.hostname}${request.url}`

  // Create headers object
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v))
    } else if (value) {
      headers.set(key, value)
    }
  }

  // Create request body
  let body: string | null = null
  if (request.body) {
    body = JSON.stringify(request.body)
    headers.set('content-type', 'application/json')
  }

  return new Request(url, {
    method: request.method,
    headers,
    body,
  })
}

export default async function authRoutes(fastify: FastifyInstance) {
  // Better Auth API endpoints - these are handled by Better Auth itself
  // We just need to mount the auth.api handler

  // Mount Better Auth API routes
  fastify.all('/auth/*', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = createRequestFromFastify(request)
      const response = await auth.handler(authRequest)

      reply.status(response.status)
      response.headers.forEach((value, key) => reply.header(key, value))
      reply.send(response.body ? await response.text() : null)
    } catch (error) {
      console.error('Auth API error:', error)
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Authentication service error',
      })
    }
  })

  // // Check if user has permission
  fastify.post<{
    Body: {
      resource: string
      action: string
    }
  }>(
    '/auth/has-permission',
    {
      preHandler: [authenticate],
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const body = request.body as { resource: string; action: string }
        const { resource, action } = body

        // For now, we'll use role-based checking instead of the permission API
        // This is simpler and more reliable
        const hasPermission = request.user?.role === 'admin' || action === 'read'

        return {
          hasPermission,
        }
      } catch (error) {
        console.error('Permission check error:', error)
        reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to check permission',
        })
      }
    },
  )

  // Admin-only: Create user (for initial admin setup)
  fastify.post<{
    Body: {
      email: string
      password: string
      name?: string
      role?: string
    }
  }>(
    '/auth/create-user',
    {
      preHandler: [authenticate],
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      // Only allow admins to create users
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Admin role required',
        })
      }

      try {
        const body = request.body as {
          email: string
          password: string
          name?: string
          role?: string
        }
        const { email, password, name } = body

        const result = await auth.api.signUpEmail({
          body: {
            email,
            password,
            name: name || '',
          },
        })

        // Check if there was an error in the response
        if (!result.user) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Failed to create user',
          })
        }

        // For now, we'll return basic user info without role
        // The role will be set to 'user' by default in the database
        return {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
          },
        }
      } catch (error) {
        console.error('Create user error:', error)
        reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create user',
        })
      }
    },
  )
}
