import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { buildServer } from '../../index'
import { prisma } from '../../database/prisma'
import { FastifyInstance } from 'fastify'
import { getAuthHeaders } from '../../../test/auth-helper'

describe('Connections API', () => {
    let server: FastifyInstance

    beforeAll(async () => {
        server = await buildServer()
        await server.ready()
    })

    afterAll(async () => {
        await server.close()
    })

    beforeEach(async () => {
        await prisma.connection.deleteMany()
        await prisma.node.deleteMany()
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()
    })

    afterEach(async () => {
        await prisma.connection.deleteMany()
        await prisma.node.deleteMany()
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()
    })

    it('should create a connection', async () => {
        const { headers } = await getAuthHeaders(server)

        // Create project and nodes
        const project = await prisma.project.create({
            data: {
                name: 'test-project',
                addr: 'https://github.com/test/project',
                type: 'App',
            },
        })

        const fromNode = await prisma.node.create({
            data: {
                name: 'fromNode',
                projectId: project.id,
                projectName: 'test-project',
                branch: 'main',
                type: 'NamedExport',
                relativePath: 'src/index.ts',
                startLine: 1,
                startColumn: 1,
                endLine: 10,
                endColumn: 1,
                version: '1.0.0',
                qlsVersion: '1.0.0',
                meta: {},
            },
        })

        const toNode = await prisma.node.create({
            data: {
                name: 'toNode',
                projectId: project.id,
                projectName: 'test-project',
                branch: 'main',
                type: 'NamedExport',
                relativePath: 'src/utils.ts',
                startLine: 1,
                startColumn: 1,
                endLine: 10,
                endColumn: 1,
                version: '1.0.0',
                qlsVersion: '1.0.0',
                meta: {},
            },
        })

        const response = await server.inject({
            method: 'POST',
            url: '/connections',
            headers,
            payload: {
                fromId: fromNode.id,
                toId: toNode.id,
            },
        })

        if (response.statusCode !== 201) {
            console.error('Create connection failed:', response.body)
        }
        expect(response.statusCode).toBe(201)
        const connection = response.json()
        expect(connection.fromId).toBe(fromNode.id)
        expect(connection.toId).toBe(toNode.id)
    })

    it('should get connections', async () => {
        // Create project and nodes
        const project = await prisma.project.create({
            data: {
                name: 'test-project',
                addr: 'https://github.com/test/project',
                type: 'App',
            },
        })

        const fromNode = await prisma.node.create({
            data: {
                name: 'fromNode',
                projectId: project.id,
                projectName: 'test-project',
                branch: 'main',
                type: 'NamedExport',
                relativePath: 'src/index.ts',
                startLine: 1,
                startColumn: 1,
                endLine: 10,
                endColumn: 1,
                version: '1.0.0',
                qlsVersion: '1.0.0',
                meta: {},
            },
        })

        const toNode = await prisma.node.create({
            data: {
                name: 'toNode',
                projectId: project.id,
                projectName: 'test-project',
                branch: 'main',
                type: 'NamedExport',
                relativePath: 'src/utils.ts',
                startLine: 1,
                startColumn: 1,
                endLine: 10,
                endColumn: 1,
                version: '1.0.0',
                qlsVersion: '1.0.0',
                meta: {},
            },
        })

        await prisma.connection.create({
            data: {
                fromId: fromNode.id,
                toId: toNode.id,
            },
        })

        const response = await server.inject({
            method: 'GET',
            url: '/connections',
        })

        expect(response.statusCode).toBe(200)
        const result = response.json()
        expect(result.data).toHaveLength(1)
    })
})
