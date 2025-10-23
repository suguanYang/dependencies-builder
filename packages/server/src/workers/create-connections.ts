import { PrismaClient } from '../generated/prisma/client'

/**
 * Optimized connection auto-creation algorithm using batch operations
 * This should be run in a worker thread to avoid blocking the main thread
 */
export async function optimizedAutoCreateConnections(prisma: PrismaClient): Promise<{
  createdConnections: number
  skippedConnections: number
  errors: string[]
}> {
  const result = {
    totalNodes: 0,
    createdConnections: 0,
    skippedConnections: 0,
    errors: [] as string[],
  }

  try {
    // Get all nodes in batches to avoid memory issues
    const nodes = await prisma.node.findMany({
      select: {
        id: true,
        type: true,
        name: true,
        projectName: true,
        meta: true,
      },
    })

    result.totalNodes = nodes.length

    // Group nodes by type for efficient lookup
    const nodesByType = new Map<string, typeof nodes>()
    for (const node of nodes) {
      const type = node.type
      if (!nodesByType.has(type)) {
        nodesByType.set(type, [])
      }
      nodesByType.get(type)!.push(node)
    }

    // Get existing connections to avoid duplicates
    const existingConnections = await prisma.connection.findMany({
      select: {
        fromId: true,
        toId: true,
      },
    })

    // Create a Set for fast lookup of existing connections
    const existingConnectionSet = new Set(
      existingConnections.map((conn) => `${conn.fromId}:${conn.toId}`),
    )

    // Collect all connections to create in batches
    const connectionsToCreate: Array<{ fromId: string; toId: string }> = []

    // Rule 1: NamedImport -> NamedExport
    const namedImports = nodesByType.get('NamedImport') || []
    const namedExports = nodesByType.get('NamedExport') || []
    for (const importNode of namedImports) {
      const [packageName, importName] = importNode.name.split('.')
      const matchingExports = namedExports.filter(
        (exportNode) =>
          exportNode.name === importName &&
          // es6 imports should be from the index file, and we are not consider the sub files import
          ((exportNode.meta as Record<string, string>)?.entryName === 'index' ||
            (exportNode.meta as Record<string, string>)?.entryName === 'seeyon_ui_index' ||
            (exportNode.meta as Record<string, string>)?.entryName === 'seeyon_mui_index') &&
          exportNode.projectName === packageName &&
          exportNode.projectName !== importNode.projectName,
      )

      for (const exportNode of matchingExports) {
        const connectionKey = `${importNode.id}:${exportNode.id}`
        if (!existingConnectionSet.has(connectionKey)) {
          connectionsToCreate.push({
            fromId: importNode.id,
            toId: exportNode.id,
          })
        } else {
          result.skippedConnections++
        }
      }
    }

    // Rule 2: RuntimeDynamicImport -> NamedExport
    const runtimeImports = nodesByType.get('RuntimeDynamicImport') || []
    for (const runtimeImport of runtimeImports) {
      const [packageName, _, importName] = runtimeImport.name.split('.')

      if (packageName && importName) {
        const matchingExports = namedExports.filter(
          (exportNode) =>
            exportNode.name === importName &&
            exportNode.projectName === packageName &&
            exportNode.projectName !== runtimeImport.projectName,
        )

        for (const exportNode of matchingExports) {
          const connectionKey = `${runtimeImport.id}:${exportNode.id}`
          if (!existingConnectionSet.has(connectionKey)) {
            connectionsToCreate.push({
              fromId: runtimeImport.id,
              toId: exportNode.id,
            })
          } else {
            result.skippedConnections++
          }
        }
      }
    }

    // Rule 3: GlobalVarRead -> GlobalVarWrite
    const globalVarReads = nodesByType.get('GlobalVarRead') || []
    const globalVarWrites = nodesByType.get('GlobalVarWrite') || []
    for (const readNode of globalVarReads) {
      const matchingWrites = globalVarWrites.filter(
        (writeNode) =>
          writeNode.name === readNode.name && writeNode.projectName !== readNode.projectName,
      )

      for (const writeNode of matchingWrites) {
        const connectionKey = `${readNode.id}:${writeNode.id}`
        if (!existingConnectionSet.has(connectionKey)) {
          connectionsToCreate.push({
            fromId: readNode.id,
            toId: writeNode.id,
          })
        } else {
          result.skippedConnections++
        }
      }
    }

    // Rule 4: WebStorageRead -> WebStorageWrite
    const storageReads = nodesByType.get('WebStorageRead') || []
    const storageWrites = nodesByType.get('WebStorageWrite') || []
    for (const readNode of storageReads) {
      const readMeta = readNode.meta as Record<string, any>
      if (readMeta?.storageKey) {
        const storageKey = readMeta.storageKey as string
        const matchingWrites = storageWrites.filter((writeNode) => {
          const writeMeta = writeNode.meta as Record<string, any>
          return (
            writeMeta?.storageKey === storageKey && writeNode.projectName !== readNode.projectName
          )
        })

        for (const writeNode of matchingWrites) {
          const connectionKey = `${readNode.id}:${writeNode.id}`
          if (!existingConnectionSet.has(connectionKey)) {
            connectionsToCreate.push({
              fromId: readNode.id,
              toId: writeNode.id,
            })
          } else {
            result.skippedConnections++
          }
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
        const matchingEmits = eventEmits.filter((emitNode) => {
          const emitMeta = emitNode.meta as Record<string, any>
          return emitMeta?.eventName === eventName && emitNode.projectName !== onNode.projectName
        })

        for (const emitNode of matchingEmits) {
          const connectionKey = `${onNode.id}:${emitNode.id}`
          if (!existingConnectionSet.has(connectionKey)) {
            connectionsToCreate.push({
              fromId: onNode.id,
              toId: emitNode.id,
            })
          } else {
            result.skippedConnections++
          }
        }
      }
    }

    // Rule 6: DynamicModuleFederationReference -> NamedExport
    const dynamicModuleFederationReferences =
      nodesByType.get('DynamicModuleFederationReference') || []
    for (const dynamicModuleFederationReference of dynamicModuleFederationReferences) {
      const [referProject, referName] = dynamicModuleFederationReference.name.split('.')
      const matchingExports = namedExports.filter(
        (exportNode) =>
          (exportNode.meta as Record<string, string>)?.entryName === referName &&
          exportNode.projectName === referProject,
      )

      for (const exportNode of matchingExports) {
        const connectionKey = `${dynamicModuleFederationReference.id}:${exportNode.id}`
        if (!existingConnectionSet.has(connectionKey)) {
          connectionsToCreate.push({
            fromId: dynamicModuleFederationReference.id,
            toId: exportNode.id,
          })
        } else {
          result.skippedConnections++
        }
      }
    }

    try {
      await prisma.connection.createMany({
        data: connectionsToCreate,
      })
      result.createdConnections = connectionsToCreate.length
    } catch (batchError) {
      result.errors.push(`Failed to create connections: ${batchError}`)
    }

    return result
  } catch (error) {
    result.errors.push(`Failed to auto-create connections: ${error}`)
    return result
  }
}
