import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { buildServer } from '../../index'
import { prisma } from '../../database/prisma'
import { FastifyInstance } from 'fastify'
import { getAuthHeaders } from '../../../test/auth-helper'

describe('Projects API', () => {
    let server: FastifyInstance

    beforeAll(async () => {
        server = await buildServer()
        await server.ready()
    })

    afterAll(async () => {
        await server.close()
    })

    beforeEach(async () => {
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()
    })

    afterEach(async () => {
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()
    })

    it('should create a project', async () => {
        const { headers } = await getAuthHeaders(server, 'admin')

        const response = await server.inject({
            method: 'POST',
            url: '/projects',
            headers,
            payload: {
                name: 'test-project',
                addr: 'https://github.com/test/project',
                type: 'App',
            },
        })

        if (response.statusCode !== 201) {
            console.error('Create project failed:', response.body)
        }
        expect(response.statusCode).toBe(201)
        const project = response.json()
        expect(project.name).toBe('test-project')
    })

    it('should get projects', async () => {
        await prisma.project.create({
            data: {
                name: 'test-project',
                addr: 'https://github.com/test/project',
                type: 'App',
            },
        })

        const response = await server.inject({
            method: 'GET',
            url: '/projects',
        })

        expect(response.statusCode).toBe(200)
        const result = response.json()
        expect(result.data).toHaveLength(1)
        expect(result.data[0].name).toBe('test-project')
    })

    it('should get project by name', async () => {
        await prisma.project.create({
            data: {
                name: 'test-project',
                addr: 'https://github.com/test/project',
                type: 'App',
            },
        })

        const response = await server.inject({
            method: 'GET',
            url: '/projects/name/test-project',
        })

        expect(response.statusCode).toBe(200)
        const project = response.json()
        expect(project.name).toBe('test-project')
    })

    it('should update a project', async () => {
        const { headers } = await getAuthHeaders(server, 'admin')

        const project = await prisma.project.create({
            data: {
                name: 'test-project',
                addr: 'https://github.com/test/project',
                type: 'App',
            },
        })

        const response = await server.inject({
            method: 'PUT',
            url: `/projects/${project.id}`,
            headers,
            payload: {
                name: 'updated-project',
            },
        })

        expect(response.statusCode).toBe(200)
        const updated = response.json()
        expect(updated.name).toBe('updated-project')
    })

    it('should delete a project', async () => {
        const { headers } = await getAuthHeaders(server, 'admin')

        const project = await prisma.project.create({
            data: {
                name: 'test-project',
                addr: 'https://github.com/test/project',
                type: 'App',
            },
        })

        const response = await server.inject({
            method: 'DELETE',
            url: `/projects/${project.id}`,
            headers,
        })

        expect(response.statusCode).toBe(200)
        const check = await prisma.project.findUnique({
            where: { id: project.id },
        })
        expect(check).toBeNull()
    })
    it('should get project by id', async () => {
        const project = await prisma.project.create({
            data: {
                name: 'test-project-by-id',
                addr: 'https://github.com/test/project-by-id',
                type: 'App',
            },
        })

        const response = await server.inject({
            method: 'GET',
            url: `/projects/${project.id}`,
        })

        expect(response.statusCode).toBe(200)
        const result = response.json()
        expect(result.id).toBe(project.id)
    })
})
