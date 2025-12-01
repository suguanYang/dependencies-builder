import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { globSync, readFileSync } from 'node:fs'

// Only mock external dependencies (command execution, file system)
vi.mock('../utils/run', () => ({
    default: vi.fn(),
}))

vi.mock('node:fs', () => ({
    globSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    cpSync: vi.fn(),
    rmSync: vi.fn(),
}))

vi.mock('../utils/fs-helper', () => ({
    ensureDirectoryExistsSync: vi.fn(),
    existsSync: vi.fn(() => true),
    directoryExistsSync: vi.fn(() => true),
}))

vi.mock('../context', () => ({
    getContext: vi.fn(() => ({
        getWorkingDirectory: () => '/test/repo',
        getMetadata: () => ({ name: 'test-project' }),
    })),
}))

describe('CodeQL Runner', () => {
    let run: any
    let CodeQL: any

    beforeEach(async () => {
        // Import the mocked run function
        const runModule = await import('../utils/run')
        run = runModule.default

        // Setup default mock behavior
        vi.mocked(run).mockResolvedValue({} as any)

        // Import CodeQL class after mocks are configured
        const codeqlModule = await import('./codeql-runner')
        CodeQL = codeqlModule.CodeQL
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('initialize', () => {
        it('should check CodeQL version with correct command', async () => {
            const codeql = new CodeQL()

            vi.mocked(run)
                .mockResolvedValueOnce(JSON.stringify({ version: '2.15.0' }))
                .mockResolvedValueOnce(JSON.stringify({ extractors: { javascript: {} } }))

            await codeql.initialize()

            // Verify the external command was called correctly
            expect(run).toHaveBeenCalledWith(
                expect.stringContaining('codeql'),
                ['version', '--format=json'],
                {},
                true
            )
        })

        it('should verify JavaScript language support', async () => {
            const codeql = new CodeQL()

            vi.mocked(run)
                .mockResolvedValueOnce(JSON.stringify({ version: '2.15.0' }))
                .mockResolvedValueOnce(JSON.stringify({ extractors: { javascript: {} } }))

            await codeql.initialize()

            // Verify language check command
            expect(run).toHaveBeenCalledWith(
                expect.stringContaining('codeql'),
                [
                    'resolve',
                    'languages',
                    '--format=betterjson',
                    '--extractor-options-verbosity=4',
                    '--extractor-include-aliases',
                ],
                {},
                true
            )
        })

        it('should throw error when CodeQL is not installed', async () => {
            const codeql = new CodeQL()

            // Mock external command failure
            vi.mocked(run).mockRejectedValueOnce(new Error('Command not found'))

            await expect(codeql.initialize()).rejects.toThrow('CodeQL CLI not found')
        })
    })

    describe('createDatabase', () => {
        it('should create database with correct parameters', async () => {
            const codeql = new CodeQL()

            await codeql.createDatabase()

            // Verify external command invocation
            expect(run).toHaveBeenCalledWith(
                expect.stringContaining('codeql'),
                expect.arrayContaining([
                    'database',
                    'create',
                    expect.stringContaining('codeql-database'),
                    '--language=javascript',
                    expect.stringMatching(/--source-root=.*\/dist$/),
                    '--build-mode=none',
                    expect.stringMatching(/--threads=\d+/),
                    '--no-calculate-baseline',
                    expect.stringMatching(/--codescanning-config=/),
                ])
            )
        })
    })

    describe('runQueries', () => {
        it('should run queries with correct parameters', async () => {
            const codeql = new CodeQL()

            await codeql.runQueries()

            // Verify external command invocation
            expect(run).toHaveBeenCalledWith(
                expect.stringContaining('codeql'),
                expect.arrayContaining([
                    'database',
                    'run-queries',
                    expect.stringContaining('codeql-database'),
                    expect.stringContaining('queries'),
                    expect.stringMatching(/--threads=\d+/),
                ])
            )
        })
    })

    describe('runSingleQuery', () => {
        it('should run single query with fixed thread count', async () => {
            const codeql = new CodeQL()
            const queryPath = '/path/to/query.ql'
            const queryName = 'test-query'

            await codeql.runSingleQuery(queryPath, queryName)

            // Verify external command invocation
            expect(run).toHaveBeenCalledWith(
                expect.stringContaining('codeql'),
                expect.arrayContaining([
                    'database',
                    'run-queries',
                    expect.stringContaining('codeql-database'),
                    queryPath,
                    '--threads=4',
                ])
            )
        })
    })

    describe('interpretResults', () => {
        it('should decode BQRS files with correct format', async () => {
            const codeql = new CodeQL()

            // Mock file system response
            vi.mocked(globSync).mockReturnValue(['/results/test.bqrs'])

            await codeql.interpretResults()

            // Verify external command invocation
            expect(run).toHaveBeenCalledWith(
                expect.stringContaining('codeql'),
                expect.arrayContaining([
                    'bqrs',
                    'decode',
                    '/results/test.bqrs',
                    expect.stringMatching(/--output=.*test\.json/),
                    '--format=json',
                ])
            )
        })
    })

    describe('decodeSingleResult', () => {
        it('should decode single result with correct output path', async () => {
            const codeql = new CodeQL()
            const queryName = 'test-query'

            // Mock file system response
            vi.mocked(readFileSync).mockReturnValue(
                JSON.stringify({ '#select': { tuples: [['value1', 'value2']] } })
            )

            await codeql.decodeSingleResult(queryName)

            // Verify external command invocation
            expect(run).toHaveBeenCalledWith(
                expect.stringContaining('codeql'),
                expect.arrayContaining([
                    'bqrs',
                    'decode',
                    expect.stringContaining(`${queryName}.bqrs`),
                    expect.stringMatching(/--output=.*\.json/),
                    '--format=json',
                ]),
                {}
            )
        })

        it('should return empty array when result file does not exist', async () => {
            const { existsSync } = await import('../utils/fs-helper')
            const codeql = new CodeQL()

            // Mock file system to indicate file doesn't exist
            vi.mocked(existsSync).mockReturnValue(false)

            const result = await codeql.decodeSingleResult('nonexistent')

            expect(result).toEqual([])
            // Should not call external command if file doesn't exist
            expect(run).not.toHaveBeenCalled()
        })
    })

    describe('getDatabasePath', () => {
        it('should return correct database path', () => {
            const codeql = new CodeQL()
            const dbPath = codeql.getDatabasePath()

            expect(dbPath).toContain('codeql-database')
            expect(dbPath).toContain('/test/repo')
        })
    })
})
