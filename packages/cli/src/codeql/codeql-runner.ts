import path, { join } from 'node:path'
import run from '../utils/run'
import debug from '../utils/debug'
import { getContext } from '../context'
import { cpus } from 'node:os'
import { fileURLToPath } from 'node:url'
import { rmSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface CodeQLResult {
    tuples?: any[]
    [key: string]: any
}

export class CodeQL {
    private static readonly LANGUAGE = 'javascript'
    private static readonly THREADS_NUMBER = cpus().length * 2 || 10
    private static readonly SCAN_CONFIG_FILE = path.join(__dirname, 'scan', 'codeql-config.yml')
    private static readonly EXECUTABLE_PATH = process.env.CODEQL_EXCUTABLE_PATH || '/usr/local/codeql/codeql'

    private readonly repoPath: string
    private readonly databasePath: string
    private readonly results: string
    private readonly queries: string

    constructor() {
        const ctx = getContext()
        this.repoPath = ctx.getRepository()
        this.databasePath = join(this.repoPath, 'codeql-database')
        this.results = path.join(this.repoPath, 'codeql-results.json')
        this.queries = path.join(this.repoPath, 'queries')
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
                `--source-root=${this.repoPath}`,
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
                'analyze',
                this.databasePath,
                this.queries,
                `--threads=${CodeQL.THREADS_NUMBER}`,
                '--format=sarifv2.1.0',
                `--output=${this.results}`,
                '--rerun'
            ])
        } catch (error) {
            throw new Error(`Failed to run CodeQL queries: ${error}`)
        }
    }

    async interpretResults() {
        debug('Interpreting CodeQL results...', this.results)

    }

    cleanUp(): void {
        try {
            if (this.databasePath) {
                rmSync(this.databasePath, { recursive: true, force: true })
            }
            if (this.results) {
                rmSync(this.results, { recursive: true, force: true })
            }
        } catch (error) {
            debug('Warning: Failed to clean up some CodeQL files: %s', error)
        }
    }

    async run(): Promise<CodeQLResult[]> {
        await this.initialize()
        // await this.createDatabase()
        await this.runQueries()

        // Find all result files and interpret them
        const results: CodeQLResult[] = []
        try {
            const result = await this.interpretResults()

        } catch (error) {
            throw new Error(`Failed to process results: ${error}`)
        }

        return results
    }

    getDatabasePath(): string {
        return this.databasePath
    }
}
