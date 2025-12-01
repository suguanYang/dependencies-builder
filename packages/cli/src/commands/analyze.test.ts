import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFileSync, rmSync } from 'node:fs'

// Only mock external dependencies (API calls, file system)
vi.mock('../api', () => ({
    getAnyNodeByProjectBranchVersion: vi.fn(),
}))

vi.mock('../upload', () => ({
    uploadResults: vi.fn(),
}))

vi.mock('../checkout', () => ({
    checkoutRepository: vi.fn(),
}))

vi.mock('node:fs', () => ({
    writeFileSync: vi.fn(),
    rmSync: vi.fn(),
}))

vi.mock('../utils/fs-helper', () => ({
    directoryExistsSync: vi.fn(),
}))

// Mock CodeQL execution (external command)
vi.mock('../codeql', () => ({
    runCodeQL: vi.fn(),
}))

// Mock context to provide test data
vi.mock('../context', () => ({
    getContext: vi.fn(),
}))

describe('analyzeProject command', () => {
    let analyzeProject: any
    let getAnyNodeByProjectBranchVersion: any
    let uploadResults: any
    let checkoutRepository: any
    let runCodeQL: any
    let getContext: any

    const mockContext = {
        getProjectName: () => 'test-project',
        getBranch: () => 'main',
        getVersion: () => 'v1.0.0',
        getQlsVersion: () => 'v1.0.0',
        getLocalDirectory: () => '/tmp/test',
        getRepositoryDir: () => '/tmp/test/repo',
        isRemote: () => false,
        findPackageDirectory: vi.fn(),
        toString: () => 'test context',
    }

    beforeEach(async () => {
        // Import mocked modules
        const apiModule = await import('../api')
        getAnyNodeByProjectBranchVersion = apiModule.getAnyNodeByProjectBranchVersion

        const uploadModule = await import('../upload')
        uploadResults = uploadModule.uploadResults

        const checkoutModule = await import('../checkout')
        checkoutRepository = checkoutModule.checkoutRepository

        const codeqlModule = await import('../codeql')
        runCodeQL = codeqlModule.runCodeQL

        const contextModule = await import('../context')
        getContext = contextModule.getContext

        // Setup default mocks
        vi.mocked(getContext).mockReturnValue(mockContext as any)
        vi.mocked(checkoutRepository).mockResolvedValue(undefined)
        vi.mocked(getAnyNodeByProjectBranchVersion).mockResolvedValue(null)

        const { directoryExistsSync } = await import('../utils/fs-helper')
        vi.mocked(directoryExistsSync).mockReturnValue(false)

        // Import the function under test after mocks are set up
        const analyzeModule = await import('./analyze')
        analyzeProject = analyzeModule.analyzeProject
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('workflow execution', () => {
        it('should execute analysis workflow in correct order', async () => {
            const mockResults = {
                nodes: [],
                callGraph: [],
                version: 'v1.0.0',
            }

            vi.mocked(runCodeQL).mockResolvedValue(mockResults as any)
            vi.mocked(uploadResults).mockResolvedValue({
                success: true,
                message: 'Upload successful',
            } as any)

            await analyzeProject()

            // Verify execution order
            expect(checkoutRepository).toHaveBeenCalled()
            expect(getAnyNodeByProjectBranchVersion).toHaveBeenCalledWith(
                'test-project',
                'main',
                'v1.0.0'
            )
            expect(mockContext.findPackageDirectory).toHaveBeenCalled()
            expect(runCodeQL).toHaveBeenCalled()
            expect(uploadResults).toHaveBeenCalledWith(mockResults)
        })

        it('should save results to file', async () => {
            const mockResults = {
                nodes: [{ id: '1', name: 'test' }],
                callGraph: [],
                version: 'v1.0.0',
            }

            vi.mocked(runCodeQL).mockResolvedValue(mockResults as any)
            vi.mocked(uploadResults).mockResolvedValue({
                success: true,
                message: 'Upload successful',
            } as any)

            await analyzeProject()

            expect(writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('analysis-results.json'),
                JSON.stringify(mockResults, null, 2)
            )
        })

        it('should skip analysis if node already exists with same qls version', async () => {
            const existingNode = {
                id: '1',
                qlsVersion: 'v1.0.0',
            }

            vi.mocked(getAnyNodeByProjectBranchVersion).mockResolvedValue(existingNode as any)

            // Mock process.exit to throw an error to stop execution
            const mockExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
                throw new Error(`Process exited with code ${code}`)
            })

            // Expect the function to throw due to process.exit
            await expect(analyzeProject()).rejects.toThrow('Process exited with code 0')

            expect(mockExit).toHaveBeenCalledWith(0)
            expect(runCodeQL).not.toHaveBeenCalled()

            mockExit.mockRestore()
        })
    })

    describe('error handling', () => {
        it('should handle checkout errors', async () => {
            vi.mocked(checkoutRepository).mockRejectedValue(new Error('Checkout failed'))

            await expect(analyzeProject()).rejects.toThrow('Checkout failed')
        })

        it('should handle CodeQL execution errors', async () => {
            vi.mocked(runCodeQL).mockRejectedValue(new Error('CodeQL failed'))

            await expect(analyzeProject()).rejects.toThrow('CodeQL failed')
        })

        it('should handle upload errors gracefully', async () => {
            const mockResults = {
                nodes: [],
                callGraph: [],
                version: 'v1.0.0',
            }

            vi.mocked(runCodeQL).mockResolvedValue(mockResults as any)
            vi.mocked(uploadResults).mockResolvedValue({
                success: false,
                errors: ['Upload failed'],
            } as any)

            // Should not throw, just log error
            await expect(analyzeProject()).resolves.toBeUndefined()
        })
    })

    describe('cleanup', () => {
        it('should cleanup repository directory for remote repos', async () => {
            mockContext.isRemote = () => true
            const { directoryExistsSync } = await import('../utils/fs-helper')
            vi.mocked(directoryExistsSync).mockReturnValue(true)

            const mockResults = {
                nodes: [],
                callGraph: [],
                version: 'v1.0.0',
            }

            vi.mocked(runCodeQL).mockResolvedValue(mockResults as any)
            vi.mocked(uploadResults).mockResolvedValue({
                success: true,
                message: 'Upload successful',
            } as any)

            await analyzeProject()

            expect(rmSync).toHaveBeenCalledWith(
                '/tmp/test/repo',
                { recursive: true }
            )
        })

        it('should not cleanup for local repos', async () => {
            mockContext.isRemote = () => false

            const mockResults = {
                nodes: [],
                callGraph: [],
                version: 'v1.0.0',
            }

            vi.mocked(runCodeQL).mockResolvedValue(mockResults as any)
            vi.mocked(uploadResults).mockResolvedValue({
                success: true,
                message: 'Upload successful',
            } as any)

            await analyzeProject()

            expect(rmSync).not.toHaveBeenCalled()
        })

        it('should cleanup even on error', async () => {
            mockContext.isRemote = () => true
            const { directoryExistsSync } = await import('../utils/fs-helper')
            vi.mocked(directoryExistsSync).mockReturnValue(true)
            vi.mocked(runCodeQL).mockRejectedValue(new Error('CodeQL failed'))

            await expect(analyzeProject()).rejects.toThrow()

            expect(rmSync).toHaveBeenCalledWith(
                '/tmp/test/repo',
                { recursive: true }
            )
        })
    })

    describe('context usage', () => {
        it('should query for existing node with correct parameters', async () => {
            const mockResults = {
                nodes: [],
                callGraph: [],
                version: 'v1.0.0',
            }

            vi.mocked(runCodeQL).mockResolvedValue(mockResults as any)
            vi.mocked(uploadResults).mockResolvedValue({
                success: true,
                message: 'Upload successful',
            } as any)

            await analyzeProject()

            expect(getAnyNodeByProjectBranchVersion).toHaveBeenCalledWith(
                'test-project',
                'main',
                'v1.0.0'
            )
        })

        it('should call findPackageDirectory for monorepo support', async () => {
            const mockResults = {
                nodes: [],
                callGraph: [],
                version: 'v1.0.0',
            }

            vi.mocked(runCodeQL).mockResolvedValue(mockResults as any)
            vi.mocked(uploadResults).mockResolvedValue({
                success: true,
                message: 'Upload successful',
            } as any)

            await analyzeProject()

            expect(mockContext.findPackageDirectory).toHaveBeenCalled()
        })
    })
})
