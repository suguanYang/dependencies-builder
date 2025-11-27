import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import buildServer from '../../server'
import { prisma } from '../../database/prisma'
import { FastifyInstance } from 'fastify'

describe('Dependencies API', () => {
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

    it('should get dependencies', async () => {
        // Create project and nodes
        const project = await prisma.project.create({
            data: {
                name: 'test-project',
                addr: 'https://github.com/test/project',
                type: 'App',
            },
        })

        const node1 = await prisma.node.create({
            data: {
                name: 'node1',
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

        const node2 = await prisma.node.create({
            data: {
                name: 'node2',
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
                fromId: node1.id,
                toId: node2.id,
            },
        })

        const response = await server.inject({
            method: 'GET',
            url: `/dependencies/nodes/${node1.id}`,
        })

        expect(response.statusCode).toBe(200)
        const result = response.json()
        expect(result.vertices).toHaveLength(2)
        expect(result.edges).toHaveLength(1)
    })
})
