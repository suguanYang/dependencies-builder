import path from "path"
import { existsSync } from "../../utils/fs-helper"
import { error } from "../../utils/debug"
import { getContext } from "../../context"
import { statSync } from "fs"


const CONTROL_EXPORTS = {
    schema: './src/schema.ts',
    runtime: './src/runtime.tsx',
    attr: './src/components/attr.tsx',
    design: './src/components/design.tsx',
};

const ACTION_EXPORTS = {
    runtimeAction: ['./src/actions/runtime.ts', './src/actions/runtime.tsx'],
    schemaAction: './src/actions/schema.ts',
};


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
            entry && validEntries.push(entry)
        }
        return validEntries
    } catch (err) {
        error(`Failed to get entries in sy config: ${err as string}`)
        return []
    }
}


const getEntries = () => {
    const ctx = getContext()
    const entries: string[] = []
    if (ctx.getType() === 'lib') {
        entries.push('index.ts')
        entries.push('index.tsx')
        entries.push(...getEntriesInConfig(ctx.getWorkingDirectory()))
    } else {
        // entries.push(...getEntriesInWebpackConfig(ctx.getWorkingDirectory()))
    }

    if (ctx.getMetadata().name === 'main') {
        entries.push('ui/index.tsx')
        entries.push('ui/schemas/index.ts')
    }
    return entries.filter(entry => existsSync(path.join(ctx.getWorkingDirectory(), 'src', entry)))
}

export default getEntries