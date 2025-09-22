import path from "path"
import { existsSync } from "../../utils/fs-helper"
import { error } from "../../utils/debug"
import { getContext } from "../../context"

const getEntriesInWebpackConfig = (wd: string): string[] => {
    const webpackConfigFile = path.join(wd, 'webpack-overrides.js')

    if (!existsSync(webpackConfigFile)) {
        return []
    }

    try {
        const webpackConfig = require(webpackConfigFile)
        return webpackConfig()
    } catch (err) {
        error(`Failed to get entries in webpack config: ${err as string}`)
        return []
    }
}

const getEntriesInConfig = (wd: string) => {
    const syConfigFile = path.join(wd, 'sy.config.json')

    if (!existsSync(syConfigFile)) {
        return []
    }

    try {
        const syConfig = require(syConfigFile)
        return syConfig.exports
    } catch (err) {
        error(`Failed to get entries in sy config: ${err as string}`)
        return []
    }
}


const getEntries = () => {
    const ctx = getContext()
    const entries: string[] = []
    if (ctx.getType() === 'app') {
        entries.push(...getEntriesInWebpackConfig(ctx.getRepository()))
    } else {
        entries.push('index.ts')
        entries.push('index.tsx')
        entries.push(...getEntriesInConfig(ctx.getRepository()))
    }
    if (ctx.getMetadata().name === 'main') {
        entries.push('ui/index.tsx')
    }
    return entries.filter(entry => existsSync(path.join(ctx.getRepository(), entry)))
}

export default getEntries