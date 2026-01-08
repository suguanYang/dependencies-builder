import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import buildServer from '../../server'
import { prisma } from '../../database/prisma'
import { FastifyInstance } from 'fastify'
import { getAuthHeaders } from '../../../test/auth-helper'

describe('GitRepo API', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await prisma.gitRepo.deleteMany()
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
  })

  afterEach(async () => {
    await prisma.gitRepo.deleteMany()
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
  })

  it('should create a new git repo (admin only)', async () => {
    const { headers } = await getAuthHeaders(server, 'admin')

    const gitRepoData = {
      name: 'test-repo',
      host: 'gitlab.example.com',
      apiUrl: 'https://gitlab.example.com/api/v4',
      accessToken: 'glpat-test-token',
      enabled: true,
    }

    const response = await server.inject({
      method: 'POST',
      url: '/git-repos',
      headers,
      payload: gitRepoData,
    })

    expect(response.statusCode).toBe(200)
    const result = response.json()
    expect(result.name).toBe('test-repo')
    expect(result.host).toBe('gitlab.example.com')
    expect(result.accessToken).toBe('glpat-test-token')
  })

  it('should get all git repos (admin only)', async () => {
    // Create test repos
    await prisma.gitRepo.createMany({
      data: [
        {
          name: 'repo1',
          host: 'gitlab.example.com',
          apiUrl: 'https://gitlab.example.com/api/v4',
          accessToken: 'token1',
        },
        {
          name: 'repo2',
          host: 'gitlab2.example.com',
          apiUrl: 'https://gitlab2.example.com/api/v4',
          accessToken: 'token2',
        },
      ],
    })

    const { headers } = await getAuthHeaders(server, 'admin')

    const response = await server.inject({
      method: 'GET',
      url: '/git-repos',
      headers,
    })

    expect(response.statusCode).toBe(200)
    const result = response.json()
    expect(result.data).toHaveLength(2)
    expect(result.total).toBe(2)
  })

  it('should get git repo by ID (admin only)', async () => {
    const createdRepo = await prisma.gitRepo.create({
      data: {
        name: 'test-repo',
        host: 'gitlab.example.com',
        apiUrl: 'https://gitlab.example.com/api/v4',
        accessToken: 'test-token',
      },
    })

    const { headers } = await getAuthHeaders(server, 'admin')

    const response = await server.inject({
      method: 'GET',
      url: `/git-repos/${createdRepo.id}`,
      headers,
    })

    expect(response.statusCode).toBe(200)
    const result = response.json()
    expect(result.id).toBe(createdRepo.id)
    expect(result.name).toBe('test-repo')
  })

  it('should get git repo by host (CLI authenticated)', async () => {
    await prisma.gitRepo.create({
      data: {
        name: 'test-repo',
        host: 'gitlab.example.com',
        apiUrl: 'https://gitlab.example.com/api/v4',
        accessToken: 'test-token',
      },
    })

    const { headers } = await getAuthHeaders(server, 'user')

    const response = await server.inject({
      method: 'GET',
      url: '/git-repos/by-host',
      query: { host: 'gitlab.example.com' },
      headers,
    })

    expect(response.statusCode).toBe(200)
    const result = response.json()
    expect(result.host).toBe('gitlab.example.com')
  })

  it('should return 404 for non-existent git repo by host', async () => {
    const { headers } = await getAuthHeaders(server, 'user')

    const response = await server.inject({
      method: 'GET',
      url: '/git-repos/by-host',
      query: { host: 'nonexistent.example.com' },
      headers,
    })

    expect(response.statusCode).toBe(404)
  })

  it('should update git repo (admin only)', async () => {
    const createdRepo = await prisma.gitRepo.create({
      data: {
        name: 'test-repo',
        host: 'gitlab.example.com',
        apiUrl: 'https://gitlab.example.com/api/v4',
        accessToken: 'old-token',
      },
    })

    const { headers } = await getAuthHeaders(server, 'admin')

    const response = await server.inject({
      method: 'PUT',
      url: `/git-repos/${createdRepo.id}`,
      headers,
      payload: {
        accessToken: 'new-token',
        enabled: false,
      },
    })

    expect(response.statusCode).toBe(200)
    const result = response.json()
    expect(result.accessToken).toBe('new-token')
    expect(result.enabled).toBe(false)
  })

  it('should delete git repo (admin only)', async () => {
    const createdRepo = await prisma.gitRepo.create({
      data: {
        name: 'test-repo',
        host: 'gitlab.example.com',
        apiUrl: 'https://gitlab.example.com/api/v4',
        accessToken: 'test-token',
      },
    })

    const { headers } = await getAuthHeaders(server, 'admin')

    const response = await server.inject({
      method: 'DELETE',
      url: `/git-repos/${createdRepo.id}`,
      headers,
    })

    expect(response.statusCode).toBe(200)

    // Verify deletion
    const deletedRepo = await prisma.gitRepo.findUnique({
      where: { id: createdRepo.id },
    })
    expect(deletedRepo).toBeNull()
  })

  it('should prevent duplicate git repo names', async () => {
    await prisma.gitRepo.create({
      data: {
        name: 'test-repo',
        host: 'gitlab.example.com',
        apiUrl: 'https://gitlab.example.com/api/v4',
        accessToken: 'token1',
      },
    })

    const { headers } = await getAuthHeaders(server, 'admin')

    const response = await server.inject({
      method: 'POST',
      url: '/git-repos',
      headers,
      payload: {
        name: 'test-repo', // Duplicate name
        host: 'gitlab2.example.com',
        apiUrl: 'https://gitlab2.example.com/api/v4',
        accessToken: 'token2',
      },
    })

    expect(response.statusCode).toBe(409)
  })

  it('should deny access to non-admin users for admin endpoints', async () => {
    const { headers } = await getAuthHeaders(server, 'user')

    const response = await server.inject({
      method: 'GET',
      url: '/git-repos',
      headers,
    })

    expect(response.statusCode).toBe(403)
  })
})
