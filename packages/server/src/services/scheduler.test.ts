import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ConnectionScheduler } from './scheduler'
import { prisma } from '../database/prisma'
import { ConnectionWorkerPool } from '../workers/worker-pool'

// Only mock the worker pool, as it performs background processing we don't want to run in tests
vi.mock('../workers/worker-pool', () => ({
    ConnectionWorkerPool: {
        getPool: vi.fn(() => ({
            executeConnectionAutoCreation: vi.fn(),
        })),
    },
}))

describe('ConnectionScheduler', () => {
    const scheduler: ConnectionScheduler = ConnectionScheduler.getInstance()

    afterEach(async () => {
        scheduler.stopPolling()
        scheduler.stopPolling()
        await prisma.action.deleteMany()
        await prisma.lock.deleteMany()
        vi.clearAllMocks()
    })

    describe('Singleton', () => {
        it('should return the same instance', () => {
            const instance1 = ConnectionScheduler.getInstance()
            const instance2 = ConnectionScheduler.getInstance()
            expect(instance1).toBe(instance2)
        })
    })

    describe('scheduleConnectionAutoCreate', () => {
        describe('Manual Trigger', () => {
            it('should return existing running action without modification', async () => {
                // Setup existing running action
                const existing = await prisma.action.create({
                    data: {
                        type: 'connection_auto_create',
                        status: 'running',
                        parameters: {},
                    },
                })

                const result = await scheduler.scheduleConnectionAutoCreate(true)

                expect(result.id).toBe(existing.id)
                expect(result.status).toBe('running')
            })

            it('should advance pending action to NOW and execute immediately', async () => {
                // Setup pending action scheduled for future
                const existing = await scheduler.scheduleConnectionAutoCreate()

                const executeMock = vi.fn()
                vi.mocked(ConnectionWorkerPool.getPool).mockReturnValue({ executeConnectionAutoCreation: executeMock } as any)

                await scheduler.scheduleConnectionAutoCreate(true)

                const updated = await prisma.action.findUnique({ where: { id: existing.id } })
                expect(updated).toBeDefined()
                // Check if scheduledFor is close to now (within 1000ms is standard for "now")
                const diff = Math.abs(new Date().getTime() - updated!.scheduledFor!.getTime())
                expect(diff).toBeLessThan(1000)
                expect(updated!.status).toBe('running')

                // Verify immediate execution
                expect(executeMock).toHaveBeenCalledWith(existing.id)
            })

            it('should create new action scheduled for NOW and execute immediately if none exists', async () => {
                const executeMock = vi.fn()
                vi.mocked(ConnectionWorkerPool.getPool).mockReturnValue({ executeConnectionAutoCreation: executeMock } as any)

                await scheduler.scheduleConnectionAutoCreate(true)

                const created = await prisma.action.findFirst({
                    where: { type: 'connection_auto_create' }
                })

                expect(created).toBeDefined()
                expect(created!.status).toBe('running') // Status is running because we create it locked

                const diff = Math.abs(new Date().getTime() - created!.scheduledFor!.getTime())
                expect(diff).toBeLessThan(1000)

                // Verify immediate execution
                expect(executeMock).toHaveBeenCalledWith(created!.id)
            })
        })

        describe('Auto Trigger (Debounce)', () => {
            it('should return existing running action without modification', async () => {
                const existing = await prisma.action.create({
                    data: {
                        type: 'connection_auto_create',
                        status: 'running',
                        parameters: {},
                    },
                })

                const result = await scheduler.scheduleConnectionAutoCreate(false)

                expect(result.id).toBe(existing.id)
            })

            it('should debounce existing pending action (do nothing)', async () => {
                const futureDate = new Date(Date.now() + 100000)
                const existing = await prisma.action.create({
                    data: {
                        type: 'connection_auto_create',
                        status: 'pending',
                        parameters: {},
                        scheduledFor: futureDate,
                    },
                })

                await scheduler.scheduleConnectionAutoCreate(false)

                const check = await prisma.action.findUnique({ where: { id: existing.id } })

                // Should roughly match original scheduled time (preserving original schedule)
                // Allowing small DB rounding differences
                const diff = Math.abs(check!.scheduledFor!.getTime() - futureDate.getTime())
                expect(diff).toBeLessThan(1000)
            })

            it('should create new action scheduled for FUTURE if none exists', async () => {
                await scheduler.scheduleConnectionAutoCreate(false)

                const created = await prisma.action.findFirst({
                    where: { type: 'connection_auto_create' }
                })

                expect(created).toBeDefined()

                const DELAY_MS = 10 * 60 * 1000 // 10 minutes
                const expectedTime = new Date().getTime() + DELAY_MS
                const diff = Math.abs(expectedTime - created!.scheduledFor!.getTime())
                expect(diff).toBeLessThan(1000)
            })
        })
    })

    describe('Polling', () => {
        it('should verify polling triggers task execution using real DB', async () => {
            // 1. Create a task scheduled for the PAST so it's ready to run
            const pastDate = new Date(Date.now() - 10000)
            const task = await prisma.action.create({
                data: {
                    type: 'connection_auto_create',
                    status: 'pending',
                    parameters: {},
                    scheduledFor: pastDate,
                },
            })

            const executeMock = vi.fn()
            vi.mocked(ConnectionWorkerPool.getPool).mockReturnValue({ executeConnectionAutoCreation: executeMock } as any)

            // 2. Start polling
            vi.useFakeTimers()
            scheduler.startPolling()

            // 3. Advance timers to trigger the interval immediately (or wait for the first interval)
            // The implementation calls poll() immediately on startPolling, but it's async.
            // We need to wait for the promise chain to resolve.

            // Run pending timers (trigger setInterval if needed, though immediate call is mostly what we care about first)
            vi.runOnlyPendingTimers()

            // Wait for async operations to complete
            // Since poll() is async calling DB, we need to let the promise chain proceed.
            // With fake timers, we can just use runAllTicks or similar, but for async/await with mocked DB/worker,
            // usually a short delay or flushing promises helps.
            await new Promise(resolve => {
                // Use real setImmediate if available, or just a small timeout which FakeTimers might intercept if not configured carefully.
                // Better: iterate nextTick to flush promises.
                process.nextTick(resolve)
            })
            // Do it a few times to ensure chain completion
            await new Promise(resolve => process.nextTick(resolve))
            await new Promise(resolve => process.nextTick(resolve))

            // 4. Verify worker was called with the task ID
            expect(executeMock).toHaveBeenCalledWith(task.id)

            // 5. Verify DB state changed to 'running' (repository logic does this)
            const updatedTask = await prisma.action.findUnique({ where: { id: task.id } })
            expect(updatedTask?.status).toBe('running')

            vi.useRealTimers()
        })
    })
})
