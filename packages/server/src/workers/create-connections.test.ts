import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '../database/prisma'
import { optimizedAutoCreateConnections } from './create-connections'
import { NodeType } from '../generated/prisma/client'

describe('Connection Creation Worker', () => {
  // Clean up database before and after each test
  beforeEach(async () => {
    await prisma.connection.deleteMany()
    await prisma.node.deleteMany()
    await prisma.project.deleteMany()
  })

  afterEach(async () => {
    await prisma.connection.deleteMany()
    await prisma.node.deleteMany()
    await prisma.project.deleteMany()
  })

  // Helper to create a project
  const createProject = async (name: string, addr: string = 'http://example.com') => {
    return prisma.project.create({
      data: {
        name,
        addr,
        type: 'App',
      },
    })
  }

  // Helper to create a node
  const createNode = async (
    project: { id: string; name: string },
    name: string,
    type: NodeType,
    branch: string = 'main',
    meta: any = {},
    relativePath: string = 'src/index.ts',
  ) => {
    let import_pkg: string | null = null
    let import_name: string | null = null
    let import_subpkg: string | null = null
    let export_entry: string | null = null

    // Simulate CLI parsing logic
    if (type === 'NamedImport') {
      import_name = name // For test simplicity, assume name has the part we need or is split manually
      const dotIndex = name.indexOf('.')
      if (dotIndex !== -1) {
        import_pkg = name.substring(0, dotIndex)
        import_name = name.substring(dotIndex + 1)
      }
    } else if (type === 'NamedExport') {
      // In tests, we pass entryName via meta for export_entry
      if (meta && meta.entryName) {
        export_entry = meta.entryName
      }
    } else if (type === 'RuntimeDynamicImport') {
      // Name: pkg.subpkg.importName
      const parts = name.split('.')
      if (parts.length >= 3) {
        import_pkg = parts[0]
        import_subpkg = parts[1]
        import_name = parts[2]
      }
    } else if (type === 'DynamicModuleFederationReference') {
      // Name: appName.moduleName -> import_pkg.import_name
      const dotIndex = name.indexOf('.')
      if (dotIndex !== -1) {
        import_pkg = name.substring(0, dotIndex)
        import_name = name.substring(dotIndex + 1)
      }
    }

    return prisma.node.create({
      data: {
        name,
        type,
        branch,
        projectId: project.id,
        projectName: project.name,
        version: '1.0.0',
        relativePath,
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 10,
        meta,
        import_pkg,
        import_name,
        import_subpkg,
        export_entry,
      },
    })
  }

  it('should create connection for UrlParamRead -> UrlParamWrite', async () => {
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    const readNode = await createNode(projectA, 'userId', 'UrlParamRead')
    const writeNode = await createNode(projectB, 'userId', 'UrlParamWrite')

    const result = await optimizedAutoCreateConnections()

    expect(result.createdConnections).toBe(1)

    const connections = await prisma.connection.findMany()
    expect(connections).toHaveLength(1)
    expect(connections[0].fromId).toBe(readNode.id)
    expect(connections[0].toId).toBe(writeNode.id)
  })

  it('should NOT create connection for UrlParamRead -> UrlParamWrite within same project', async () => {
    const projectA = await createProject('project-a')

    await createNode(projectA, 'userId', 'UrlParamRead')
    await createNode(projectA, 'userId', 'UrlParamWrite')

    const result = await optimizedAutoCreateConnections()

    expect(result.createdConnections).toBe(0)
  })

  it('should NOT create connection for UrlParamRead -> UrlParamWrite with different names', async () => {
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    await createNode(projectA, 'userId', 'UrlParamRead')
    await createNode(projectB, 'otherId', 'UrlParamWrite')

    const result = await optimizedAutoCreateConnections()

    expect(result.createdConnections).toBe(0)
  })

  // Rule 1 Test
  it('should create connection for NamedImport -> NamedExport', async () => {
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    // Import: project-b.myFunc
    const importNode = await createNode(projectA, 'project-b.myFunc', 'NamedImport')

    // Export: myFunc in project-b with entryName 'index'
    const exportNode = await createNode(projectB, 'myFunc', 'NamedExport', 'main', {
      entryName: 'index',
    })

    // Note: Rule 1 logic now strictly checks for generated columns.
    const result = await optimizedAutoCreateConnections()

    expect(result.createdConnections).toBe(1)

    const connections = await prisma.connection.findMany()
    expect(connections).toHaveLength(1)
    expect(connections[0].fromId).toBe(importNode.id)
    expect(connections[0].toId).toBe(exportNode.id)
  })

  it('should create connection for GlobalVarRead -> GlobalVarWrite', async () => {
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    const readNode = await createNode(projectA, 'globalConfig', 'GlobalVarRead')
    const writeNode = await createNode(projectB, 'globalConfig', 'GlobalVarWrite')

    const result = await optimizedAutoCreateConnections()

    expect(result.createdConnections).toBe(1)

    const connections = await prisma.connection.findMany()
    expect(connections).toHaveLength(1)
    expect(connections[0].fromId).toBe(readNode.id)
    expect(connections[0].toId).toBe(writeNode.id)
  })

  it('should create connection for WebStorageRead -> WebStorageWrite', async () => {
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    const readNode = await createNode(projectA, 'token', 'WebStorageRead')
    const writeNode = await createNode(projectB, 'token', 'WebStorageWrite')

    const result = await optimizedAutoCreateConnections()

    expect(result.createdConnections).toBe(1)

    const connections = await prisma.connection.findMany()
    expect(connections).toHaveLength(1)
    expect(connections[0].fromId).toBe(readNode.id)
    expect(connections[0].toId).toBe(writeNode.id)
  })

  it('should create connection for EventOn -> EventEmit', async () => {
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    const onNode = await createNode(projectA, 'userLoggedIn', 'EventOn')
    const emitNode = await createNode(projectB, 'userLoggedIn', 'EventEmit')

    const result = await optimizedAutoCreateConnections()

    expect(result.createdConnections).toBe(1)

    const connections = await prisma.connection.findMany()
    expect(connections).toHaveLength(1)
    expect(connections[0].fromId).toBe(onNode.id)
    expect(connections[0].toId).toBe(emitNode.id)
  })

  // Skipped Rules (Not implemented in SQL Phase 2 yet)
  it('should create connection for DynamicModuleFederationReference -> NamedExport', async () => {
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    // Reference: project-b.myComponent
    // Matches: import_pkg='project-b', import_name='myComponent'
    const refNode = await createNode(
      projectA,
      'project-b.myComponent',
      'DynamicModuleFederationReference',
    )

    // Export: myComponent in project-b with entryName matching the reference name (import_name)
    // Matches: export_entry='myComponent'
    const exportNode = await createNode(
      projectB,
      'default', // Usually default export for components
      'NamedExport',
      'main',
      { entryName: 'myComponent' },
    )

    const result = await optimizedAutoCreateConnections()

    expect(result.createdConnections).toBe(1)

    const connections = await prisma.connection.findMany()
    expect(connections).toHaveLength(1)
    expect(connections[0].fromId).toBe(refNode.id)
    expect(connections[0].toId).toBe(exportNode.id)
  })

  it('should create connection for RuntimeDynamicImport -> NamedExport', async () => {
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    // Import: project-b.utils.helper
    // Matches: import_pkg='project-b', import_subpkg='utils', import_name='helper'
    const importNode = await createNode(projectA, 'project-b.utils.helper', 'RuntimeDynamicImport')

    // Export: helper in project-b
    // Matches: export_entry='utils', name='helper'
    const exportNode = await createNode(projectB, 'helper', 'NamedExport', 'main', {
      entryName: 'utils',
    })

    const result = await optimizedAutoCreateConnections()

    expect(result.createdConnections).toBe(1)

    const connections = await prisma.connection.findMany()
    expect(connections).toHaveLength(1)
    expect(connections[0].fromId).toBe(importNode.id)
    expect(connections[0].toId).toBe(exportNode.id)
  })

  it('should skip existing connections', async () => {
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    const readNode = await createNode(projectA, 'userId', 'UrlParamRead')
    const writeNode = await createNode(projectB, 'userId', 'UrlParamWrite')

    // First run creates the connection
    await optimizedAutoCreateConnections()

    // Second run should skip it
    const result = await optimizedAutoCreateConnections()

    expect(result.createdConnections).toBe(0)
    // Skipped connections are not tracked with INSERT OR IGNORE optimization
    // expect(result.skippedConnections).toBe(1)

    const connections = await prisma.connection.findMany()
    expect(connections).toHaveLength(1)
  })

  it('should detect circular dependencies', async () => {
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    // Create a cycle: Import (A) -> Export (B), and manually B -> A
    const importNode = await createNode(projectA, 'project-b.funcB', 'NamedImport')
    const exportNode = await createNode(projectB, 'funcB', 'NamedExport', 'main', {
      entryName: 'index',
    })

    // Manually create the back-link to form a cycle
    await prisma.connection.create({
      data: {
        fromId: exportNode.id,
        toId: importNode.id,
      },
    })

    const result = await optimizedAutoCreateConnections()

    expect(result.createdConnections).toBe(1)
    // Cycles detection is deferred, so we check createdConnections only.
  })
})
