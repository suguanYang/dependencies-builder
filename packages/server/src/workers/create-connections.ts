import { prisma } from '../database/prisma'

/**
 * Optimized connection auto-creation algorithm using batch operations
 * This should be run in a worker thread to avoid blocking the main thread
 */
export async function optimizedAutoCreateConnections(): Promise<{
  createdConnections: number
  skippedConnections: number
  errors: string[]
  cycles: string[][]
}> {
  const result = {
    totalNodes: 0,
    createdConnections: 0,
    skippedConnections: 0,
    errors: [] as string[],
    cycles: [] as string[][],
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
        branch: true,
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
          exportNode.branch === importNode.branch &&
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
            exportNode.branch === runtimeImport.branch &&
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
          writeNode.name === readNode.name &&
          writeNode.branch === readNode.branch &&
          writeNode.projectName !== readNode.projectName,
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
      const storageKey = readNode.name
      const matchingWrites = storageWrites.filter((writeNode) => {
        return (
          writeNode.name === storageKey &&
          writeNode.branch === readNode.branch &&
          writeNode.projectName !== readNode.projectName
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

    // Rule 5: EventOn -> EventEmit
    const eventOns = nodesByType.get('EventOn') || []
    const eventEmits = nodesByType.get('EventEmit') || []

    for (const onNode of eventOns) {
      const onEventName = onNode.name
      const matchingEmits = eventEmits.filter((emitNode) => {
        return (
          emitNode?.name === onEventName &&
          emitNode.branch === onNode.branch &&
          emitNode.projectName !== onNode.projectName
        )
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

    // Rule 6: DynamicModuleFederationReference -> NamedExport
    const dynamicModuleFederationReferences =
      nodesByType.get('DynamicModuleFederationReference') || []
    for (const dynamicModuleFederationReference of dynamicModuleFederationReferences) {
      const [referProject, referName] = dynamicModuleFederationReference.name.split('.')
      const matchingExports = namedExports.filter(
        (exportNode) =>
          (exportNode.meta as Record<string, string>)?.entryName === referName &&
          exportNode.branch === dynamicModuleFederationReference.branch &&
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

    // Rule 7: UrlParamRead -> UrlParamWrite
    const urlParamReads = nodesByType.get('UrlParamRead') || []
    const urlParamWrites = nodesByType.get('UrlParamWrite') || []

    for (const readNode of urlParamReads) {
      const paramName = readNode.name
      const matchingWrites = urlParamWrites.filter((writeNode) => {
        return (
          writeNode.name === paramName &&
          writeNode.branch === readNode.branch &&
          writeNode.projectName !== readNode.projectName
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

    try {
      await prisma.connection.createMany({
        data: connectionsToCreate,
      })
      result.createdConnections = connectionsToCreate.length
    } catch (batchError) {
      result.errors.push(`Failed to create connections: ${batchError}`)
    }

    // Circular Dependency Detection
    const cycles: string[][] = []
    try {
      // Fetch all connections to build the graph
      const allConnections = await prisma.connection.findMany({
        select: {
          fromId: true,
          toId: true,
        },
      })

      const graph: Record<string, string[]> = {}
      allConnections.forEach((conn) => {
        if (!graph[conn.fromId]) graph[conn.fromId] = []
        graph[conn.fromId].push(conn.toId)
      })

      const visited: Record<string, boolean> = {}
      const recStack: Record<string, boolean> = {}

      const dfs = (nodeId: string, path: string[]) => {
        if (recStack[nodeId]) {
          const cycleStart = path.indexOf(nodeId)
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart))
          }
          return
        }

        if (visited[nodeId]) return

        visited[nodeId] = true
        recStack[nodeId] = true
        path.push(nodeId)

        if (graph[nodeId]) {
          graph[nodeId].forEach((neighbor) => {
            dfs(neighbor, [...path])
          })
        }

        recStack[nodeId] = false
        path.pop()
      }

      Object.keys(graph).forEach((nodeId) => {
        if (!visited[nodeId]) {
          dfs(nodeId, [])
        }
      })
    } catch (cycleError) {
      result.errors.push(`Failed to detect circular dependencies: ${cycleError}`)
    }

    return {
      ...result,
      cycles,
    }
  } catch (error) {
    result.errors.push(`Failed to auto-create connections: ${error}`)
    return { ...result, cycles: [] }
  }
}
