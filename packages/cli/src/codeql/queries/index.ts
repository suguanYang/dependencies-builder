import path from "node:path"
import { fileURLToPath } from "node:url"
import { cpSync, readFileSync, writeFileSync } from "node:fs"

import getEntries from "./entries"
import { getContext } from "../../context"
import { entryExportsQuery } from "./query.ql"
import { ensureDirectoryExistsSync } from "../../utils/fs-helper"
import { ExportQuery, ImportQuery, LibsDynamicImportQuery, GlobalVariableQuery, EventQuery, WebStorageQuery, NodeType } from "./type"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const buildQueries = () => {
    const ctx = getContext()
    ensureDirectoryExistsSync(
        path.join(ctx.getRepository(), 'queries')
    )

    const entries = getEntries()
    const entryQuery = entryExportsQuery.replace('$$entryQuery$$', entries.map(entry => `
(
entry = "${entry}"
and
getFileExports(entry, name, location)
)
        `).join(' or '))
    writeFileSync(path.join(ctx.getRepository(), 'queries', 'export.ql'), entryQuery)

    cpSync(path.join(__dirname, 'qls'), path.join(ctx.getRepository(), 'queries'), { recursive: true })

    // cp qlpack.yml to queries
    writeFileSync(path.join(ctx.getRepository(), 'queries', 'qlpack.yml'), readFileSync(path.join(__dirname, 'qlpack.yml'), 'utf-8').replace('&&name&&', ctx.getMetadata().name))
}

type QueryResults = {
    namedExports: ReturnType<typeof parseExportQuery>
    es6Imports: ReturnType<typeof parseES6ImportQuery>
    dynamicImports: ReturnType<typeof parseLibsDynamicImportQuery>
    globalVariables: ReturnType<typeof parseGlobalVariableQuery>
    event: ReturnType<typeof parseEventOnQuery>
}
const processQuery = (queryResultDir: string) => {
    const results: QueryResults = {
        namedExports: parseExportQuery(queryResultDir),
        es6Imports: parseES6ImportQuery(queryResultDir),
        dynamicImports: parseLibsDynamicImportQuery(queryResultDir),
        globalVariables: parseGlobalVariableQuery(queryResultDir),
        event: parseEventOnQuery(queryResultDir),
    }

    return formatResults(results)
}

const parseExportQuery = (queryResultDir: string) => {
    const ctx = getContext()
    const project = ctx.getMetadata().name
    try {
        const entryQueryResult = JSON.parse(readFileSync(path.join(queryResultDir, 'export.json'), 'utf-8')) as ExportQuery
        return entryQueryResult['#select'].tuples.map((tuple: [string, string, string]) => ({
            project,
            branch: ctx.getBranch(),
            type: NodeType.NamedExport,
            name: tuple[1],
            relativePath: tuple[2],
            startLine: parseInt(tuple[2].split(':')[1]),
            startColumn: parseInt(tuple[2].split(':')[2]),
            version: ctx.getMetadata().version,
            meta: {
                entry: tuple[0],
            },
        }))
    } catch (error) {
        throw new Error(`Failed to parse entry query result: ${error}`)
    }
}

const parseES6ImportQuery = (queryResultDir: string) => {
    const ctx = getContext()
    const project = ctx.getMetadata().name
    try {
        const importResult = JSON.parse(readFileSync(path.join(queryResultDir, 'import.json'), 'utf-8')) as ImportQuery
        return importResult['#select'].tuples.map((tuple: [string, string, string]) => ({
            project,
            branch: ctx.getBranch(),
            type: NodeType.NamedImport,
            name: tuple[1],
            relativePath: tuple[2],
            startLine: parseInt(tuple[2].split(':')[1]),
            startColumn: parseInt(tuple[2].split(':')[2]),
            version: ctx.getMetadata().version,
            meta: {
                module: tuple[0],
                importName: tuple[1]
            },
        }))
    } catch (error) {
        console.warn('Failed to parse ES6 import query result:', error)
        return []
    }
}

const parseLibsDynamicImportQuery = (queryResultDir: string) => {
    const ctx = getContext()
    const project = ctx.getMetadata().name
    try {
        const dynamicImportResult = JSON.parse(readFileSync(path.join(queryResultDir, 'libs-dynamic-import.json'), 'utf-8')) as LibsDynamicImportQuery
        return dynamicImportResult['#select'].tuples.map((tuple: [string, string, string, string]) => ({
            project,
            branch: ctx.getBranch(),
            type: NodeType.RuntimeDynamicImport,
            name: tuple[0],
            relativePath: tuple[1],
            startLine: parseInt(tuple[1].split(':')[1]),
            startColumn: parseInt(tuple[1].split(':')[2]),
            version: ctx.getMetadata().version,
            meta: {
                packageName: tuple[2],
                subPackageName: tuple[3]
            },
        }))
    } catch (error) {
        console.warn('Failed to parse dynamic import query result:', error)
        return []
    }
}

const parseGlobalVariableQuery = (queryResultDir: string) => {
    const ctx = getContext()
    const project = ctx.getMetadata().name
    try {
        const globalVarResult = JSON.parse(readFileSync(path.join(queryResultDir, 'global-variable.json'), 'utf-8')) as GlobalVariableQuery
        return globalVarResult['#select'].tuples.map((tuple: [string, string, string]) => ({
            project,
            branch: ctx.getBranch(),
            type: NodeType.GlobalState,
            name: tuple[0],
            relativePath: tuple[1],
            startLine: parseInt(tuple[1].split(':')[1]),
            startColumn: parseInt(tuple[1].split(':')[2]),
            version: ctx.getMetadata().version,
            meta: {
                variableName: tuple[0]
            },
        }))
    } catch (error) {
        console.warn('Failed to parse global variable query result:', error)
        return []
    }
}

const parseEventOnQuery = (queryResultDir: string) => {
    const ctx = getContext()
    const project = ctx.getMetadata().name
    try {
        const eventOnResult = JSON.parse(readFileSync(path.join(queryResultDir, 'event.json'), 'utf-8')) as EventQuery
        return eventOnResult['#select'].tuples.map((tuple: [string, string, string]) => ({
            project,
            branch: ctx.getBranch(),
            type: tuple[2] === 'On' ? NodeType.EventOn : NodeType.EventEmit,
            name: tuple[0],
            relativePath: tuple[1],
            startLine: parseInt(tuple[1].split(':')[1]),
            startColumn: parseInt(tuple[1].split(':')[2]),
            version: ctx.getMetadata().version,
            meta: {
                eventName: tuple[0]
            },
        }))
    } catch (error) {
        console.warn('Failed to parse event on query result:', error)
        return []
    }
}

const formatResults = (results: QueryResults) => {
    const ctx = getContext()
    const allNodes = [
        ...results.namedExports,
        ...results.es6Imports,
        ...results.dynamicImports,
        ...results.globalVariables,
        ...results.event,
    ]

    const summary = {
        project: ctx.getMetadata().name,
        branch: ctx.getBranch(),
        version: ctx.getMetadata().version,
        timestamp: new Date().toISOString(),
        totalNodes: allNodes.length,
        nodesByType: {
            [NodeType.NamedExport]: results.namedExports.length,
            [NodeType.NamedImport]: results.es6Imports.length,
            [NodeType.RuntimeDynamicImport]: results.dynamicImports.length,
            [NodeType.GlobalState]: results.globalVariables.length,
            [NodeType.EventOn]: results.event.filter(event => event.type === NodeType.EventOn).length,
            [NodeType.EventEmit]: results.event.filter(event => event.type === NodeType.EventEmit).length,
        }
    }

    return {
        summary,
        nodes: allNodes
    }
}

export {
    buildQueries,
    processQuery
}