import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import buildServer from '../../server'
import { prisma } from '../../database/prisma'
import { FastifyInstance } from 'fastify'
import { getAuthHeaders } from '../../../test/auth-helper'

describe('Auth API', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
  })

  afterEach(async () => {
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
  })

  it('should check permission', async () => {
    const { headers } = await getAuthHeaders(server, 'admin')

    const response = await server.inject({
      method: 'POST',
      url: '/auth/has-permission',
      headers,
      payload: {
        permission: 'admin',
      },
    })

    if (response.statusCode !== 200) {
      console.error('Check permission failed:', response.body)
    }
    expect(response.statusCode).toBe(200)
    const result = response.json()
    expect(result.hasPermission).toBe(true)
  })

  it('should fail check permission without auth', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/has-permission',
      payload: {
        permission: 'admin',
      },
    })

    expect(response.statusCode).toBe(401)
  })
})
