import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { buildServer } from '../../index'
import { prisma } from '../../database/prisma'
import { FastifyInstance } from 'fastify'
import { getAuthHeaders } from '../../../test/auth-helper'

describe('Nodes API', () => {
    let server: FastifyInstance

    beforeAll(async () => {
        server = await buildServer()
        await server.ready()
    })

    afterAll(async () => {
        await server.close()
    })

    beforeEach(async () => {
        await prisma.node.deleteMany()
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()
    })

    afterEach(async () => {
        await prisma.node.deleteMany()
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()
    })

    it('should create a node', async () => {
        const { headers } = await getAuthHeaders(server)

        // Create a project first
        const project = await prisma.project.create({
            data: {
                name: 'test-project',
                addr: 'https://github.com/test/project',
                type: 'App',
            },
        })

        const response = await server.inject({
            method: 'POST',
            url: '/nodes',
            headers,
            payload: {
                projectName: 'test-project',
                branch: 'main',
                type: 'NamedExport',
                name: 'testFunction',
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

        if (response.statusCode !== 201) {
            console.error('Create node failed:', response.body)
        }
        expect(response.statusCode).toBe(201)
        const node = response.json()
        expect(node.name).toBe('testFunction')
        expect(node.projectId).toBe(project.id)
    })

    it('should get nodes', async () => {
        // Create a project
        const project = await prisma.project.create({
            data: {
                name: 'test-project-2',
                addr: 'https://github.com/test/project-2',
                type: 'App',
            },
        })

        // Create a node
        await prisma.node.create({
            data: {
                projectId: project.id,
                projectName: 'test-project-2',
                branch: 'main',
                type: 'NamedExport',
                name: 'testFunction2',
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

        const response = await server.inject({
            method: 'GET',
            url: '/nodes',
            query: {
                projectName: 'test-project-2',
            },
        })

        if (response.statusCode !== 200) {
            console.error('Get nodes failed:', response.body)
        }
        expect(response.statusCode).toBe(200)
        const result = response.json()
        expect(result.data).toHaveLength(1)
        expect(result.data[0].name).toBe('testFunction2')
    })
})
