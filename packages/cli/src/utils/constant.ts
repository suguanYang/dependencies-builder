import path from "path"
import { fileURLToPath } from "node:url"

declare const __PROD__: boolean

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const PACKAGE_ROOT = __PROD__
    ? path.resolve(__dirname, '../')  // Production: dist -> package root
    : path.resolve(__dirname, '../../') // Development: src -> package root (same path)