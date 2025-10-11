import { NodeType } from '../../src/generated/prisma'

export const mockNodes = [
  {
    id: 'node-1',
    project: 'test-project',
    branch: 'main',
    type: NodeType.NamedExport,
    name: 'exportedFunction',
    relativePath: 'src/lib.ts',
    startLine: 10,
    startColumn: 5,
    endLine: 1,
    endColumn: 1,
    version: '1.0.0',
    meta: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'node-2',
    project: 'test-project',
    branch: 'main',
    type: NodeType.NamedImport,
    name: 'importedFunction',
    relativePath: 'src/app.ts',
    startLine: 15,
    startColumn: 8,
    endLine: 1,
    endColumn: 1,
    version: '1.0.0',
    meta: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'node-3',
    project: 'another-project',
    branch: 'main',
    type: NodeType.NamedExport,
    name: 'sharedFunction',
    relativePath: 'src/utils.ts',
    startLine: 20,
    startColumn: 12,
    endLine: 1,
    endColumn: 1,
    version: '1.0.0',
    meta: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

export const mockConnections = [
  {
    id: 'conn-1',
    fromId: 'node-2',
    toId: 'node-1',
    createdAt: new Date().toISOString()
  },
  {
    id: 'conn-2',
    fromId: 'node-2',
    toId: 'node-3',
    createdAt: new Date().toISOString()
  }
]

export const mockDependencyGraph = {
  vertices: [
    {
      data: { id: 'node-1', name: 'exportedFunction', type: NodeType.NamedExport, project: 'test-project', branch: 'main' },
      firstIn: 0,
      firstOut: -1
    },
    {
      data: { id: 'node-2', name: 'importedFunction', type: NodeType.NamedImport, project: 'test-project', branch: 'main' },
      firstIn: -1,
      firstOut: 0
    }
  ],
  edges: [
    {
      data: { id: 'conn-1', fromId: 'node-2', toId: 'node-1' },
      tailvertex: 1,
      headvertex: 0,
      headnext: -1,
      tailnext: -1
    }
  ]
}

export const mockProjectGraph = {
  vertices: [
    {
      data: { id: 'node-1', name: 'exportedFunction', type: NodeType.NamedExport, project: 'test-project', branch: 'main' },
      firstIn: 0,
      firstOut: -1
    },
    {
      data: { id: 'node-2', name: 'importedFunction', type: NodeType.NamedImport, project: 'test-project', branch: 'main' },
      firstIn: -1,
      firstOut: 0
    }
  ],
  edges: [
    {
      data: { id: 'conn-1', fromId: 'node-2', toId: 'node-1' },
      tailvertex: 1,
      headvertex: 0,
      headnext: -1,
      tailnext: -1
    }
  ]
}