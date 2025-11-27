
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import buildServer from '../../server'
import { prisma } from '../../database/prisma'
import { FastifyInstance } from 'fastify'
import { getAuthHeaders } from '../../../test/auth-helper'

// Mock worker pool to avoid actual background processing
vi.mock('../../workers/worker-pool', () => ({
    ConnectionWorkerPool: {
        getPool: () => ({
            executeConnectionAutoCreation: async () => ({ success: true }),
            stopExecution: () => true,
        }),
    },
}))

// Mock cli-service
vi.mock('../../services/cli-service', () => ({
    executeCLI: async () => ({ success: true, stdout: 'mock output', stderr: '' }),
    getActiveExecution: () => ({
        stop: async () => { },
    }),
}))

describe('Actions API', () => {
    let server: FastifyInstance

    beforeAll(async () => {
        server = await buildServer()
        await server.ready()
    })

    afterAll(async () => {
        await server.close()
    })

    beforeEach(async () => {
        await prisma.action.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()
    })

    afterEach(async () => {
        await prisma.action.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()
    })

    it('should create an action', async () => {
        const { headers } = await getAuthHeaders(server)

        const response = await server.inject({
            method: 'POST',
            url: '/actions',
            headers,
            payload: {
                type: 'static_analysis',
                parameters: {
                    projectId: 'test-project',
                },
            },
        })

        if (response.statusCode !== 201) {
            console.error('Create action failed:', response.body)
        }
        expect(response.statusCode).toBe(201)
        const action = response.json()
        expect(action.type).toBe('static_analysis')
        expect(action.status).toBe('pending')
    })

    it('should get actions', async () => {
        const { headers } = await getAuthHeaders(server)

        await prisma.action.create({
            data: {
                type: 'static_analysis',
                status: 'pending',
                parameters: {},
            },
        })

        const response = await server.inject({
            method: 'GET',
            url: '/actions',
            headers,
        })

        expect(response.statusCode).toBe(200)
        const result = response.json()
        expect(result.data).toHaveLength(1)
    })

    it('should trigger connection auto create', async () => {
        const { headers } = await getAuthHeaders(server)

        const response = await server.inject({
            method: 'POST',
            url: '/actions/connection-auto-create',
            headers,
            payload: {
                projectId: 'test-project',
                branch: 'main',
            },
        })

        if (response.statusCode !== 201) {
            console.error('Trigger action failed:', response.body)
        }
        expect(response.statusCode).toBe(201)
        const action = response.json()
        expect(action.type).toBe('connection_auto_create')
    })

    it('should return existing action if connection auto create is already running', async () => {
        const { headers } = await getAuthHeaders(server)

        // Create an initial action
        await prisma.action.create({
            data: {
                type: 'connection_auto_create',
                status: 'running',
                parameters: {},
            },
        })

        const response = await server.inject({
            method: 'POST',
            url: '/actions/connection-auto-create',
            headers,
            payload: {
                projectId: 'test-project',
                branch: 'main',
            },
        })

        expect(response.statusCode).toBe(200)
        const action = response.json()
        expect(action.type).toBe('connection_auto_create')
        expect(action.status).toBe('running')
    })
    it('should get action by id', async () => {
        const { headers } = await getAuthHeaders(server)

        const created = await prisma.action.create({
            data: {
                type: 'static_analysis',
                status: 'pending',
                parameters: {},
            },
        })

        const response = await server.inject({
            method: 'GET',
            url: `/actions/${created.id}`,
            headers,
        })

        expect(response.statusCode).toBe(200)
        const action = response.json()
        expect(action.id).toBe(created.id)
    })

    it('should update an action', async () => {
        const { headers } = await getAuthHeaders(server)

        const created = await prisma.action.create({
            data: {
                type: 'static_analysis',
                status: 'pending',
                parameters: {},
            },
        })

        const response = await server.inject({
            method: 'PUT',
            url: `/actions/${created.id}`,
            headers,
            payload: {
                status: 'completed',
            },
        })

        expect(response.statusCode).toBe(200)
        const action = response.json()
        expect(action.status).toBe('completed')
    })

    it('should delete an action', async () => {
        const { headers } = await getAuthHeaders(server)

        const created = await prisma.action.create({
            data: {
                type: 'static_analysis',
                status: 'pending',
                parameters: {},
            },
        })

        const response = await server.inject({
            method: 'DELETE',
            url: `/actions/${created.id}`,
            headers,
        })

        expect(response.statusCode).toBe(200)
        const check = await prisma.action.findUnique({
            where: { id: created.id },
        })
        expect(check).toBeNull()
    })

    it('should stop an action', async () => {
        const { headers } = await getAuthHeaders(server)

        const created = await prisma.action.create({
            data: {
                type: 'connection_auto_create',
                status: 'running',
                parameters: {},
            },
        })

        const response = await server.inject({
            method: 'POST',
            url: `/actions/${created.id}/stop`,
            headers,
        })

        expect(response.statusCode).toBe(200)
        const result = response.json()
        expect(result.success).toBe(true)
    })
})
