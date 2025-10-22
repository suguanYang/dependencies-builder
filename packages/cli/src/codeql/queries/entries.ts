import { statSync, readFileSync } from "node:fs"
import path from "node:path"
import { existsSync } from "../../utils/fs-helper"
import debug, { error } from "../../utils/debug"
import { getContext } from "../../context"

const CONTROL_EXPORTS = {
    schema: './dist/schema.ts',
    runtime: './dist/runtime.tsx',
    attr: './dist/components/attr.tsx',
    design: './dist/components/design.tsx',
};

const ACTION_EXPORTS = {
    runtimeAction: ['./dist/actions/runtime.ts', './dist/actions/runtime.tsx'],
    schemaAction: './dist/actions/schema.ts',
};

function runMfExposesMatcher(code: string) {
    const regex = /exposes\['(.*?)'\]\s*=\s*'(.*?)'/g;
    const matches = [...code.matchAll(regex)];

    const results = matches.map(match => ({
        name: match[1].replace('./', ''),
        path: match[2]
    }));

    return results;
}

const getEntriesInWebpackConfig = (wd: string) => {
    const entries = []
    const webpackConfigFile = path.join(wd, 'webpack-overrides.js')

    // defalut mf entry
    entries.push({
        name: 'Entry',
        path: 'app.tsx'
    })

    entries.push({
        name: 'Entry',
        path: 'app.jsx'
    })


    if (!existsSync(webpackConfigFile)) {
        return []
    }

    const code = readFileSync(webpackConfigFile, 'utf-8')
    const exposes = runMfExposesMatcher(code)


    for (const expose of exposes) {
        if (!expose.path) {
            continue
        }
        entries.push({
            name: expose.name,
            path: expose.path.replace(`./src/`, '')
        })
    }

    return entries
}

const getEntriesInConfig = (wd: string) => {
    const syConfigFile = path.join(wd, 'sy.config.json')

    if (!existsSync(syConfigFile)) {
        return []
    }
    const fromCwd = (relative: string) => {
        if (existsSync(path.join(wd, relative)) && statSync(path.join(wd, relative)).isFile()) {
            return path.join(wd, relative)
        }
        return null
    }
    try {
        const syConfig = require(syConfigFile)
        const allEntries = {
            ...syConfig.exports,
            ...(syConfig.control ? CONTROL_EXPORTS : {}),
            ...(syConfig.actions ? ACTION_EXPORTS : {}),
        }

        const validEntries = []
        for (const name in allEntries) {
            const entry = fromCwd(allEntries[name])
            entry && validEntries.push({ name, path: entry })
        }
        return validEntries
    } catch (err) {
        error(`Failed to get entries in sy config: ${err as string}`)
        return []
    }
}


const getEntries = () => {
    const ctx = getContext()
    const entries: { name: string, path: string }[] = []
    if (ctx.getType() === 'Lib') {
        entries.push({ name: 'index', path: 'index.ts' })
        entries.push({ name: 'index', path: 'index.tsx' })
        entries.push(...getEntriesInConfig(ctx.getWorkingDirectory()))
    } else {
        entries.push(...getEntriesInWebpackConfig(ctx.getWorkingDirectory()))
    }

    for (const predefinedEntry of ctx.getEntries()) {
        entries.push(predefinedEntry)
    }

    // ignore the entries that are not in the dist directory & reduplicate the entries that have the same name
    return entries.filter(entry => existsSync(path.join(ctx.getWorkingDirectory(), 'dist', entry.path)))
        .filter((entry, index, self) =>
            index === self.findIndex(t => t.name === entry.name)
        )
}

export default getEntries