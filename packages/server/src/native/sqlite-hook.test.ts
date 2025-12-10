import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../database/prisma'
import { setTimeout } from 'timers/promises'

describe('SQLite Update Hook (Native)', () => {
    let projectId: string

    beforeEach(async () => {
        // Clear actions to ensure a clean state
        await prisma.action.deleteMany()
        await prisma.node.deleteMany()
        await prisma.project.deleteMany()

        const project = await prisma.project.create({
            data: {
                name: 'Test Project',
                addr: 'test-addr',
                type: 'App',
            },
        })
        projectId = project.id
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    it('should trigger connection_auto_create when a node is created', async () => {
        // create a node
        await prisma.node.create({
            data: {
                name: 'Test Node',
                type: 'NamedExport',
                branch: 'main',
                projectName: 'Test Project',
                version: '1.0.0',
                relativePath: 'src/test.ts',
                startLine: 1,
                startColumn: 1,
                endLine: 10,
                endColumn: 1,
                meta: {},
                projectId: projectId,
            },
        })

        // Wait for the native hook -> callback -> event loop execution
        // The hook is asynchronous because it goes through a ThreadSafeFunction
        await setTimeout(500)

        // Check if an action was created
        const action = await prisma.action.findFirst({
            where: {
                type: 'connection_auto_create',
            },
        })

        expect(action).toBeDefined()
        expect(action?.type).toBe('connection_auto_create')
    })

    it('should trigger connection_auto_create when a node is updated', async () => {
        const node = await prisma.node.create({
            data: {
                name: 'Update Test Node',
                type: 'NamedExport',
                branch: 'main',
                projectName: 'Test Project',
                version: '1.0.0',
                relativePath: 'src/test.ts',
                startLine: 1,
                startColumn: 1,
                endLine: 10,
                endColumn: 1,
                meta: {},
                projectId: projectId,
            },
        })

        // Clear the action created by "create"
        await prisma.action.deleteMany()

        // Update the node
        await prisma.node.update({
            where: { id: node.id },
            data: {
                name: 'Updated Name',
            },
        })

        await setTimeout(500)

        const action = await prisma.action.findFirst({
            where: {
                type: 'connection_auto_create',
            },
        })

        expect(action).toBeDefined()
    })
})
