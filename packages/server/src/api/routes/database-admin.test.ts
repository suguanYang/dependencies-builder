import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import buildServer from '../../server'
import { prisma } from '../../database/prisma'
import { FastifyInstance } from 'fastify'
import { getAuthHeaders } from '../../../test/auth-helper'

describe('Database Admin API', () => {
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

    it('should execute raw query', async () => {
        const { headers } = await getAuthHeaders(server, 'admin')

        const response = await server.inject({
            method: 'POST',
            url: '/database-admin/query',
            headers,
            payload: {
                query: 'SELECT 1 as result',
            },
        })

        if (response.statusCode !== 200) {
            console.error('Execute query failed:', response.body)
        }
        expect(response.statusCode).toBe(200)
        const result = response.json()
        expect(Array.isArray(result.data)).toBe(true)
        expect(result.data[0].result).toBe(1)
    })

    it('should get schema info', async () => {
        const { headers } = await getAuthHeaders(server, 'admin')

        const response = await server.inject({
            method: 'GET',
            url: '/database-admin/schema',
            headers,
        })

        expect(response.statusCode).toBe(200)
        const result = response.json()
        expect(Array.isArray(result.tables)).toBe(true)
        // SQLite schema query returns table info
        expect(result.tables.length).toBeGreaterThan(0)
    })
})
