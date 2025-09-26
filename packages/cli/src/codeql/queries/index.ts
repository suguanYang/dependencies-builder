import path from "node:path"
import { fileURLToPath } from "node:url"
import { cpSync, readFileSync, writeFileSync } from "node:fs"

import getEntries from "./entries"
import { getContext } from "../../context"
import { entryExportsQuery } from "./query.ql"
import { ensureDirectoryExistsSync } from "../../utils/fs-helper"
import { EntryQuery, ExportQuery, NodeType } from "./type"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const buildQueries = () => {
    const ctx = getContext()
    ensureDirectoryExistsSync(
        path.join(ctx.getRepository(), 'queries')
    )

    const entries = getEntries()
    const entryQuery = entryExportsQuery.replace('$$entryQuery$$', entries.map(entry => `f.getRelativePath() = "${entry}"`).join(' or '))
    writeFileSync(path.join(ctx.getRepository(), 'queries', 'entry-exports.ql'), entryQuery)

    // cp qlpack.yml to queries
    writeFileSync(path.join(ctx.getRepository(), 'queries', 'qlpack.yml'), readFileSync(path.join(__dirname, 'qlpack.yml'), 'utf-8').replace('&&name&&', ctx.getMetadata().name))
}

const processQuery = (queryResultDir: string) => {
    const nodes = parseEntryQuery(queryResultDir)
    console.log('nodes', nodes)
}

const parseEntryQuery = (queryResultDir: string) => {
    const ctx = getContext()
    const project = ctx.getMetadata().name
    try {
        const entryQueryResult = JSON.parse(readFileSync(path.join(queryResultDir, 'entry-exports.json'), 'utf-8')) as ExportQuery
        return entryQueryResult['#select'].tuples.map(tuple => ({
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

}

const parseLibsDynamicImportQuery = (queryResultDir: string) => {

}

const parseGlobalVariableQuery = (queryResultDir: string) => {

}

const parseEventOnQuery = (queryResultDir: string) => {

}

const parseEventEmitQuery = (queryResultDir: string) => {

}

export {
    buildQueries,
    processQuery
}