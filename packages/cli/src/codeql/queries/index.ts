import path from "node:path"
import { cpSync, readFileSync, writeFileSync } from "node:fs"

import getEntries from "./entries"
import { getContext } from "../../context"
import { entryExportsQuery } from "./query.ql"
import { ensureDirectoryExistsSync } from "../../utils/fs-helper"
import { ExportQuery, ImportQuery, LibsDynamicImportQuery, GlobalVariableQuery, EventQuery, WebStorageQuery, NodeType, RemoteLoaderQuery } from "./type"
import { PACKAGE_ROOT } from "../../utils/constant"
import { projectNameToCodeQLName } from "../../utils/names"

const qlsDir = path.join(PACKAGE_ROOT, 'qls')

const buildQueries = () => {
    const ctx = getContext()
    ensureDirectoryExistsSync(
        path.join(ctx.getWorkingDirectory(), 'queries')
    )

    const entries = getEntries()
    if (entries.length > 0) {
        const entryQuery = entryExportsQuery.replace('$$entryQuery$$', entries.map(entry => `
            (
            entry = "${entry.path}"
            and
            getFileExports(entry, name, location)
            )`
        ).join(' or '))
        writeFileSync(path.join(ctx.getWorkingDirectory(), 'queries', 'export.ql'), entryQuery)
    }

    cpSync(qlsDir, path.join(ctx.getWorkingDirectory(), 'queries'), { recursive: true })

    // cp qlpack.yml to queries
    writeFileSync(path.join(ctx.getWorkingDirectory(), 'queries', 'qlpack.yml'), readFileSync(path.join(qlsDir, 'qlpack.yml'), 'utf-8')
        .replace('&&name&&', `"${projectNameToCodeQLName(ctx.getMetadata().name)}"`))
}

type QueryResults = {
    namedExports: ReturnType<typeof parseExportQuery>
    es6Imports: ReturnType<typeof parseES6ImportQuery>
    dynamicImports: ReturnType<typeof parseLibsDynamicImportQuery>
    globalVariables: ReturnType<typeof parseGlobalVariableQuery>
    eventOn: ReturnType<typeof parseEventOnQuery>
    eventEmit: ReturnType<typeof parseEventOnQuery>
    webStorage: ReturnType<typeof parseWebStorageQuery>
    remoteLoader: ReturnType<typeof parseRemoteLoaderQuery>
}
const processQuery = (queryResultDir: string) => {
    const results: QueryResults = {
        namedExports: parseExportQuery(queryResultDir),
        es6Imports: parseES6ImportQuery(queryResultDir),
        dynamicImports: parseLibsDynamicImportQuery(queryResultDir),
        globalVariables: parseGlobalVariableQuery(queryResultDir),
        eventOn: parseEventOnQuery(queryResultDir),
        eventEmit: parseEventOnQuery(queryResultDir),
        webStorage: parseWebStorageQuery(queryResultDir),
        remoteLoader: parseRemoteLoaderQuery(queryResultDir),
    }

    return formatResults(results)
}

const parseExportQuery = (queryResultDir: string) => {
    const ctx = getContext()
    const project = ctx.getMetadata().name
    const entries = getEntries()
    try {
        const entryQueryResult = JSON.parse(readFileSync(path.join(queryResultDir, 'export.json'), 'utf-8')) as ExportQuery
        return entryQueryResult['#select'].tuples.map((tuple: [string, string, string]) => {
            const entryName = entries.find(entry => entry.path === tuple[0])?.name
            return ({
                project,
                branch: ctx.getBranch(),
                type: NodeType.NamedExport,
                name: tuple[1] + (entryName === 'index' ? '' : '.' + entryName),
                ...parseLoc(tuple[2]),
                version: ctx.getMetadata().version,
                meta: {
                    entry: tuple[0],
                    entryName: entryName,
                },
            })
        })
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
            name: `${tuple[0]}.${tuple[1]}`, // importName
            ...parseLoc(tuple[2]),
            version: ctx.getMetadata().version,
            meta: {}
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
        const dynamicImportResult = JSON.parse(readFileSync(path.join(queryResultDir, 'libsDynamicImport.json'), 'utf-8')) as LibsDynamicImportQuery
        return dynamicImportResult['#select'].tuples.map((tuple: [string, string, string, string]) => ({
            project,
            branch: ctx.getBranch(),
            type: NodeType.RuntimeDynamicImport,
            name: `${tuple[0]}.${tuple[1]}.${tuple[2]}`, // namedImport
            ...parseLoc(tuple[3]),
            version: ctx.getMetadata().version,
            meta: {}
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
        const globalVarResult = JSON.parse(readFileSync(path.join(queryResultDir, 'globalVariable.json'), 'utf-8')) as GlobalVariableQuery
        return globalVarResult['#select'].tuples.map((tuple: [string, "Write" | "Read", string]) => ({
            project,
            branch: ctx.getBranch(),
            type: tuple[1] === "Write" ? NodeType.GlobalVarWrite : NodeType.GlobalVarRead,
            name: tuple[0], // variableName
            ...parseLoc(tuple[2]),
            version: ctx.getMetadata().version,
            meta: {}
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
            type: tuple[1] === 'On' ? NodeType.EventOn : NodeType.EventEmit,
            name: tuple[0], // eventName
            ...parseLoc(tuple[2]),
            version: ctx.getMetadata().version,
            meta: {}
        }))
    } catch (error) {
        console.warn('Failed to parse event on query result:', error)
        return []
    }
}

const parseWebStorageQuery = (queryResultDir: string) => {
    const ctx = getContext()
    const project = ctx.getMetadata().name
    try {
        const webStorageResult = JSON.parse(readFileSync(path.join(queryResultDir, 'webStorage.json'), 'utf-8')) as WebStorageQuery
        return webStorageResult['#select'].tuples.map((tuple: [string, "Write" | "Read", "LocalStorage" | "SessionStorage", string]) => ({
            project,
            branch: ctx.getBranch(),
            type: tuple[1] === "Write" ? NodeType.WebStorageWrite : NodeType.WebStorageRead,
            name: tuple[0], // localStorageKey
            ...parseLoc(tuple[3]),
            version: ctx.getMetadata().version,
            meta: {
                kind: tuple[2]
            }
        }))
    } catch (error) {
        console.warn('Failed to parse web storage query result:', error)
        return []
    }
}

const parseRemoteLoaderQuery = (queryResultDir: string) => {
    const ctx = getContext()
    const project = ctx.getMetadata().name
    try {
        const remoteLoaderResult = JSON.parse(readFileSync(path.join(queryResultDir, 'remoteLoader.json'), 'utf-8')) as RemoteLoaderQuery
        return remoteLoaderResult['#select'].tuples.map((tuple: [string, string, string]) => ({
            project,
            branch: ctx.getBranch(),
            type: NodeType.DynamicModuleFederationReference,
            name: `${tuple[0]}.${tuple[1]}`,
            ...parseLoc(tuple[2]),
        }))
    } catch (error) {
        console.warn('Failed to parse remote loader query result:', error)
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
        ...results.eventOn,
        ...results.eventEmit,
        ...results.webStorage,
        ...results.remoteLoader
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
            [NodeType.GlobalVarRead]: results.globalVariables.filter(node => node.type === NodeType.GlobalVarRead).length,
            [NodeType.GlobalVarWrite]: results.globalVariables.filter(node => node.type === NodeType.GlobalVarWrite).length,
            [NodeType.EventOn]: results.eventOn.length,
            [NodeType.EventEmit]: results.eventEmit.length,
            [NodeType.WebStorageRead]: results.webStorage.filter(node => node.type === NodeType.WebStorageRead).length,
            [NodeType.WebStorageWrite]: results.webStorage.filter(node => node.type === NodeType.WebStorageWrite).length,
            [NodeType.DynamicModuleFederationReference]: results.remoteLoader.length,
        }
    }

    return {
        summary,
        nodes: allNodes
    }
}

const parseLoc = (loc: string) => {
    const [relativePath, startLine, startColumn] = loc.split(':')

    return {
        relativePath,
        startLine: parseInt(startLine),
        startColumn: parseInt(startColumn),
    }
}

export {
    buildQueries,
    processQuery
}