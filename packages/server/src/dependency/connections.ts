import * as repository from '../database/repository'
import { Node } from '../generated/prisma'

/**
 * Automatically creates connections between nodes based on the rules:
 * 1. NamedExport to NamedImport
 * 2. RuntimeDynamicImport to NamedExport
 * 3. GlobalVarRead to GlobalVarWrite
 * 4. WebStorageRead to WebStorageWrite
 * 5. EventOn to EventEmit
 */
export async function autoCreateConnections(): Promise<{
    createdConnections: number
    skippedConnections: number
    errors: string[]
}> {
    const result = {
        createdConnections: 0,
        skippedConnections: 0,
        errors: [] as string[]
    }

    try {
        // Get all nodes that have no connections
        const nodesResult = await repository.getNodes({
            where: {
                fromConnections: undefined,
                toConnections: undefined,
            }
        }, true)
        const nodes = nodesResult.data

        console.log('nodesnodesnodes: ', nodes.length, nodesResult.total)

        // Group nodes by type for efficient lookup
        const nodesByType = new Map<string, Node[]>()
        for (const node of nodes) {
            const type = node.type
            if (!nodesByType.has(type)) {
                nodesByType.set(type, [])
            }
            nodesByType.get(type)!.push(node)
        }

        // Rule 1: NamedImport -> NamedExport
        const namedImports = nodesByType.get('NamedImport') || []
        const namedExports = nodesByType.get('NamedExport') || []
        for (const importNode of namedImports) {
            const [packageName, importName] = importNode.name.split('.')
            const matchingExports = namedExports.filter(exportNode =>
                exportNode.name === importName &&
                exportNode.project === packageName &&
                exportNode.project !== importNode.project
            )

            for (const exportNode of matchingExports) {
                await createConnectionIfNotExists(importNode.id, exportNode.id, result)
            }
        }

        // Rule 2: RuntimeDynamicImport -> NamedExport
        const runtimeImports = nodesByType.get('RuntimeDynamicImport') || []
        for (const runtimeImport of runtimeImports) {
            const [packageName, _, importName] = runtimeImport.name.split('.')

            if (packageName && importName) {
                const matchingExports = namedExports.filter(exportNode =>
                    exportNode.name === importName &&
                    exportNode.project === packageName &&
                    exportNode.project !== runtimeImport.project
                )

                for (const exportNode of matchingExports) {
                    await createConnectionIfNotExists(runtimeImport.id, exportNode.id, result)
                }
            }

        }

        // Rule 3: GlobalVarRead -> GlobalVarWrite
        const globalVarReads = nodesByType.get('GlobalVarRead') || []
        const globalVarWrites = nodesByType.get('GlobalVarWrite') || []
        for (const readNode of globalVarReads) {
            const matchingWrites = globalVarWrites.filter(writeNode =>
                writeNode.name === readNode.name &&
                writeNode.project !== readNode.project
            )

            for (const writeNode of matchingWrites) {
                await createConnectionIfNotExists(readNode.id, writeNode.id, result)
            }
        }

        // Rule 4: WebStorageRead -> WebStorageWrite
        const storageReads = nodesByType.get('WebStorageRead') || []
        const storageWrites = nodesByType.get('WebStorageWrite') || []
        for (const readNode of storageReads) {
            const readMeta = readNode.meta as Record<string, any>
            if (readMeta?.storageKey) {
                const storageKey = readMeta.storageKey as string
                const matchingWrites = storageWrites.filter(writeNode => {
                    const writeMeta = writeNode.meta as Record<string, any>
                    return writeMeta?.storageKey === storageKey &&
                        writeNode.project !== readNode.project
                })

                for (const writeNode of matchingWrites) {
                    await createConnectionIfNotExists(readNode.id, writeNode.id, result)
                }
            }
        }

        // Rule 5: EventOn -> EventEmit
        const eventOns = nodesByType.get('EventOn') || []
        const eventEmits = nodesByType.get('EventEmit') || []
        for (const onNode of eventOns) {
            const onMeta = onNode.meta as Record<string, any>
            if (onMeta?.eventName) {
                const eventName = onMeta.eventName as string
                const matchingEmits = eventEmits.filter(emitNode => {
                    const emitMeta = emitNode.meta as Record<string, any>
                    return emitMeta?.eventName === eventName &&
                        emitNode.project !== onNode.project
                })

                for (const emitNode of matchingEmits) {
                    await createConnectionIfNotExists(onNode.id, emitNode.id, result)
                }
            }
        }

        return result
    } catch (error) {
        result.errors.push(`Failed to auto-create connections: ${error}`)
        return result
    }
}

/**
 * Helper function to create a connection if it doesn't already exist
 */
async function createConnectionIfNotExists(
    fromId: string,
    toId: string,
    result: { createdConnections: number; skippedConnections: number; errors: string[] }
): Promise<void> {
    try {
        // Check if connection already exists
        const existingConnections = await repository.getConnections({
            fromId,
            toId
        })

        if (existingConnections.data.length === 0) {
            // Create new connection
            await repository.createConnection(fromId, toId)
            result.createdConnections++
        } else {
            result.skippedConnections++
        }
    } catch (error) {
        result.errors.push(`Failed to create connection from ${fromId} to ${toId}: ${error}`)
    }
}
