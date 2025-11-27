import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { buildServer } from '../../index'
import { prisma } from '../../database/prisma'
import * as repository from '../../database/repository'
import { FastifyInstance } from 'fastify'

describe('Fuzzy Matching API', () => {
    let app: FastifyInstance

    beforeAll(async () => {
        app = await buildServer()
        await app.ready()
    })

    afterAll(async () => {
        await app.close()
    })

    beforeEach(async () => {
        await prisma.node.deleteMany()
        await prisma.project.deleteMany()
        await prisma.connection.deleteMany()

        // Create test data
        await repository.createProject({
            name: 'FuzzyProject',
            addr: 'http://fuzzy.com',
            type: 'App',
        })

        const project = await repository.getProjectByName('FuzzyProject')

        await repository.createNode({
            projectName: 'FuzzyProject',
            branch: 'main',
            type: 'NamedExport',
            name: 'FuzzyNodeService',
            relativePath: 'src/service.ts',
            startLine: 1,
            startColumn: 1,
            endLine: 10,
            endColumn: 1,
            version: '1.0.0',
            qlsVersion: '1.0.0',
            meta: {},
            projectId: project!.id,
        })

        await repository.createNode({
            projectName: 'FuzzyProject',
            branch: 'main',
            type: 'NamedExport',
            name: 'ExactNode',
            relativePath: 'src/lib.ts',
            startLine: 1,
            startColumn: 1,
            endLine: 10,
            endColumn: 1,
            version: '1.0.0',
            qlsVersion: '1.0.0',
            meta: {},
            projectId: project!.id,
        })
    })

    afterEach(async () => {
        await prisma.node.deleteMany()
        await prisma.project.deleteMany()
        await prisma.connection.deleteMany()
    })

    it('should fuzzy match nodes by name', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/nodes',
            query: {
                name: 'Fuzzy',
                fuzzy: 'true',
            },
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.data).toHaveLength(1)
        expect(body.data[0].name).toBe('FuzzyNodeService')
    })

    it('should exact match nodes by name when fuzzy is false', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/nodes',
            query: {
                name: 'Fuzzy',
                fuzzy: 'false',
            },
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.data).toHaveLength(0)
    })

    it('should exact match nodes by name when fuzzy is false (exact match case)', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/nodes',
            query: {
                name: 'ExactNode',
                fuzzy: 'false',
            },
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.data).toHaveLength(1)
        expect(body.data[0].name).toBe('ExactNode')
    })

    it('should fuzzy match projects by name', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/projects',
            query: {
                name: 'Fuzzy',
                fuzzy: 'true',
            },
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.data).toHaveLength(1)
        expect(body.data[0].name).toBe('FuzzyProject')
    })

    it('should exact match projects by name when fuzzy is false', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/projects',
            query: {
                name: 'Fuzzy',
                fuzzy: 'false',
            },
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.data).toHaveLength(0)
    })
})
