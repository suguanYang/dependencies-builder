import path, { join } from 'node:path'
import run from '../utils/run'
import debug, { error } from '../utils/debug'
import { getContext } from '../context'
import { cpus } from 'node:os'
import { globSync, readFileSync, writeFileSync } from 'node:fs'
import { ensureDirectoryExistsSync, existsSync } from '../utils/fs-helper'
import { PACKAGE_ROOT } from '../utils/constant'
import { projectNameToCodeQLName } from '../utils/names'

const scanDir = path.join(PACKAGE_ROOT, 'scan')

export interface CodeQLResult {
    tuples?: any[]
    [key: string]: any
}

export class CodeQL {
    private static readonly LANGUAGE = 'javascript'
    private static readonly THREADS_NUMBER = cpus().length * 2 || 10
    private static readonly SCAN_CONFIG_FILE = path.join(scanDir, 'codeql-config.yml')
    private static readonly EXECUTABLE_PATH = process.env.CODEQL_EXCUTABLE_PATH || '/usr/local/codeql/codeql'

    private readonly repoPath: string
    private readonly databasePath: string
    private readonly results: string
    private readonly queries: string
    readonly outputPath: string

    constructor() {
        const ctx = getContext()
        this.repoPath = ctx.getWorkingDirectory()
        this.queries = path.join(this.repoPath, 'queries')
        this.databasePath = join(this.repoPath, 'codeql-database')
        this.results = path.join(this.databasePath, 'results', projectNameToCodeQLName(ctx.getMetadata().name))

        this.outputPath = path.join(this.repoPath, 'results')
    }

    async initialize(): Promise<void> {
        debug('Initializing CodeQL environment...')

        try {
            const versionString = await run(CodeQL.EXECUTABLE_PATH, ['version', '--format=json'], {}, true)
            const version = JSON.parse(versionString)
            debug('CodeQL version: %s', version.version)
        } catch (error) {
            throw new Error('CodeQL CLI not found. Please install CodeQL and add it to PATH')
        }

        // check language support
        try {
            const languagesString = await run(CodeQL.EXECUTABLE_PATH, ['resolve', 'languages', '--format=betterjson', '--extractor-options-verbosity=4', '--extractor-include-aliases'], {}, true)
            const languages = JSON.parse(languagesString)
            const languageKey = CodeQL.LANGUAGE

            if (languages.extractors[languageKey] === undefined) {
                throw new Error(`${CodeQL.LANGUAGE} language support not found in CodeQL.`)
            }
        } catch (error) {
            throw new Error(`Failed to check CodeQL languages: ${error}`)
        }
    }

    async createDatabase(): Promise<void> {
        debug('Creating CodeQL database...')
        try {
            await run(CodeQL.EXECUTABLE_PATH, [
                'database',
                'create',
                this.databasePath,
                `--language=${CodeQL.LANGUAGE}`,
                `--source-root=${this.repoPath}/dist`,
                '--build-mode=none',
                `--threads=${CodeQL.THREADS_NUMBER}`,
                '--no-calculate-baseline',
                `--codescanning-config=${CodeQL.SCAN_CONFIG_FILE}`
            ])
        } catch (error) {
            throw new Error(`Failed to create CodeQL database: ${error}`)
        }
    }

    async runQueries(): Promise<void> {
        debug('Running CodeQL queries...')

        try {
            await run(CodeQL.EXECUTABLE_PATH, [
                'database',
                'run-queries',
                this.databasePath,
                this.queries,
                `--threads=${CodeQL.THREADS_NUMBER}`
            ])
        } catch (err) {
            error('Failed to run CodeQL queries: %o', err)
            throw err
        }
    }

    async interpretResults() {
        debug('Interpreting CodeQL results...', this.results)

        ensureDirectoryExistsSync(this.outputPath)

        const runs = []
        const bqrsFiles = globSync(path.join(this.results, '**', '*.bqrs'))
        for (const bqrsFile of bqrsFiles) {
            const queryName = path.basename(bqrsFile).replace('.bqrs', '.json')
            runs.push(run(CodeQL.EXECUTABLE_PATH, [
                'bqrs',
                'decode',
                bqrsFile,
                `--output=${path.join(this.outputPath, queryName)}`,
                '--format=json'
            ]))
        }
        await Promise.all(runs)
    }

    async run(): Promise<CodeQLResult[]> {
        await this.initialize()
        await this.createDatabase()
        await this.runQueries()

        // Find all result files and interpret them
        const results: CodeQLResult[] = []
        try {
            await this.interpretResults()
        } catch (error) {
            throw new Error(`Failed to process results: ${error}`)
        }

        return results
    }

    getDatabasePath(): string {
        return this.databasePath
    }

    async runSingleQuery(queryContent: string, queryName: string): Promise<void> {
        debug('Running single query: %s', queryName)

        const queryPath = path.join(this.queries, `${queryName}.ql`)

        writeFileSync(queryPath, queryContent)

        try {
            await run(CodeQL.EXECUTABLE_PATH, [
                'database',
                'run-queries',
                this.databasePath,
                queryPath,
                '--threads=4'
            ])
        } catch (error) {
            debug('Failed to run query %s: %o', queryName, error)
            throw error
        }
    }

    async decodeSingleResult<T = any>(queryName: string): Promise<T[]> {
        debug('Decoding single result: %s', queryName)

        const resultsPath = path.join(this.results, `${queryName}.bqrs`)

        if (!existsSync(resultsPath)) {
            return []
        }

        try {
            await run(CodeQL.EXECUTABLE_PATH, [
                'bqrs',
                'decode',
                resultsPath,
                `--output=${path.join(this.outputPath, queryName)}.json`,
                '--format=json'
            ], {})

            const result = JSON.parse(readFileSync(path.join(this.outputPath, `${queryName}.json`)).toString())
            return result['#select']?.tuples || []
        } catch (error) {
            debug('Failed to decode result %s: %o', queryName, error)
            return []
        }
    }
}
