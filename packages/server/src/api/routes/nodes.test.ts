import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import buildServer from '../../server'
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
    it('should get node by id', async () => {
        const { headers } = await getAuthHeaders(server)

        const project = await prisma.project.create({
            data: {
                name: 'test-project-3',
                addr: 'https://github.com/test/project-3',
                type: 'App',
            },
        })

        const created = await prisma.node.create({
            data: {
                projectId: project.id,
                projectName: 'test-project-3',
                branch: 'main',
                type: 'NamedExport',
                name: 'testFunction3',
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
            url: `/nodes/${created.id}`,
            headers,
        })

        expect(response.statusCode).toBe(200)
        const node = response.json()
        expect(node.id).toBe(created.id)
    })

    it('should update a node', async () => {
        const { headers } = await getAuthHeaders(server)

        const project = await prisma.project.create({
            data: {
                name: 'test-project-4',
                addr: 'https://github.com/test/project-4',
                type: 'App',
            },
        })

        const created = await prisma.node.create({
            data: {
                projectId: project.id,
                projectName: 'test-project-4',
                branch: 'main',
                type: 'NamedExport',
                name: 'testFunction4',
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
            method: 'PUT',
            url: `/nodes/${created.id}`,
            headers,
            payload: {
                name: 'updatedFunction',
            },
        })

        expect(response.statusCode).toBe(200)
        const node = response.json()
        expect(node.name).toBe('updatedFunction')
    })

    it('should delete a node', async () => {
        const { headers } = await getAuthHeaders(server)

        const project = await prisma.project.create({
            data: {
                name: 'test-project-5',
                addr: 'https://github.com/test/project-5',
                type: 'App',
            },
        })

        const created = await prisma.node.create({
            data: {
                projectId: project.id,
                projectName: 'test-project-5',
                branch: 'main',
                type: 'NamedExport',
                name: 'testFunction5',
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
            method: 'DELETE',
            url: `/nodes/${created.id}`,
            headers,
        })

        expect(response.statusCode).toBe(200)
        const check = await prisma.node.findUnique({
            where: { id: created.id },
        })
        expect(check).toBeNull()
    })

    it('should get nodes batch', async () => {
        const project = await prisma.project.create({
            data: {
                name: 'test-project-6',
                addr: 'https://github.com/test/project-6',
                type: 'App',
            },
        })

        const node1 = await prisma.node.create({
            data: {
                projectId: project.id,
                projectName: 'test-project-6',
                branch: 'main',
                type: 'NamedExport',
                name: 'node1',
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
                projectId: project.id,
                projectName: 'test-project-6',
                branch: 'main',
                type: 'NamedExport',
                name: 'node2',
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
            url: '/nodes/batch',
            payload: {
                ids: [node1.id, node2.id],
            },
        })

        expect(response.statusCode).toBe(200)
        const result = response.json()
        expect(result.data).toHaveLength(2)
    })

    it('should batch create nodes and commit', async () => {
        const { headers } = await getAuthHeaders(server)

        await prisma.project.create({
            data: {
                name: 'test-project-7',
                addr: 'https://github.com/test/project-7',
                type: 'App',
            },
        })

        // Batch create
        const createRes = await server.inject({
            method: 'POST',
            url: '/nodes/batch-create',
            headers,
            payload: {
                shallowBranch: 'shallow-branch',
                data: [
                    {
                        projectName: 'test-project-7',
                        branch: 'main', // Original branch, will be overridden by shallowBranch
                        type: 'NamedExport',
                        name: 'node1',
                        relativePath: 'src/index.ts',
                        startLine: 1,
                        startColumn: 1,
                        endLine: 10,
                        endColumn: 1,
                        version: '1.0.0',
                        qlsVersion: '1.0.0',
                        meta: {},
                    },
                ],
            },
        })
        expect(createRes.statusCode).toBe(201)

        // Verify nodes created in shallow branch
        const shallowNodes = await prisma.node.findMany({
            where: { branch: 'shallow-branch' },
        })
        expect(shallowNodes).toHaveLength(1)

        // Commit
        const commitRes = await server.inject({
            method: 'POST',
            url: '/nodes/batch-create/commit',
            headers,
            payload: {
                shallowBranch: 'shallow-branch',
                targetBranch: 'main',
                projectNames: ['test-project-7'],
            },
        })
        expect(commitRes.statusCode).toBe(201)

        // Verify nodes moved to target branch
        const mainNodes = await prisma.node.findMany({
            where: { branch: 'main', projectName: 'test-project-7' },
        })
        expect(mainNodes).toHaveLength(1)
        expect(mainNodes[0].name).toBe('node1')
    })

    it('should rollback batch', async () => {
        const { headers } = await getAuthHeaders(server)

        await prisma.project.create({
            data: {
                name: 'test-project-8',
                addr: 'https://github.com/test/project-8',
                type: 'App',
            },
        })

        // Batch create
        await server.inject({
            method: 'POST',
            url: '/nodes/batch-create',
            headers,
            payload: {
                shallowBranch: 'shallow-branch-2',
                data: [
                    {
                        projectName: 'test-project-8',
                        branch: 'main',
                        type: 'NamedExport',
                        name: 'node1',
                        relativePath: 'src/index.ts',
                        startLine: 1,
                        startColumn: 1,
                        endLine: 10,
                        endColumn: 1,
                        version: '1.0.0',
                        qlsVersion: '1.0.0',
                        meta: {},
                    },
                ],
            },
        })

        // Rollback
        const rollbackRes = await server.inject({
            method: 'POST',
            url: '/nodes/batch-create/rollback',
            headers,
            payload: {
                shallowBranch: 'shallow-branch-2',
            },
        })
        expect(rollbackRes.statusCode).toBe(201)

        // Verify nodes deleted
        const nodes = await prisma.node.findMany({
            where: { branch: 'shallow-branch-2' },
        })
        expect(nodes).toHaveLength(0)
    })
})
