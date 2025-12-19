import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '../database/prisma'
import { NodeType } from '../generated/prisma/client'

// Import test helper to access worker functions for testing
// Note: In production these are only called via worker pool, but tests call them directly
const getNodeDependencyGraph = async (nodeId: string, opts?: { depth?: number }): Promise<string> => {
  const depth = opts?.depth ?? 100
  const result = await prisma.$queryRawUnsafe<Array<{ json: string }>>(
    `SELECT get_node_dependency_graph(?, ?) as json`,
    nodeId,
    depth,
  )
  if (!result || result.length === 0 || !result[0].json) {
    return JSON.stringify({ vertices: [], edges: [] })
  }
  return result[0].json
}

const getProjectLevelDependencyGraph = async (
  projectId: string,
  branch: string,
  opts?: { depth?: number },
): Promise<ArrayBuffer> => {
  const depth = opts?.depth ?? 100
  const result = await prisma.$queryRawUnsafe<Array<{ json: string }>>(
    `SELECT get_project_dependency_graph(?, ?, ?) as json`,
    projectId,
    branch,
    depth,
  )
  if (!result || result.length === 0 || !result[0].json) {
    const emptyGraph = JSON.stringify({ vertices: [], edges: [] })
    const buffer = Buffer.from(emptyGraph, 'utf-8')
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  }
  const json = result[0].json
  const buffer = Buffer.from(json, 'utf-8')
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

describe('Native Dependency Graph', () => {
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

  // Helpers
  const createProject = async (name: string, addr: string = 'http://example.com') => {
    return prisma.project.create({
      data: {
        name,
        addr,
        type: 'App',
      },
    })
  }

  const createNode = async (
    project: { id: string; name: string },
    name: string,
    type: NodeType,
  ) => {
    return prisma.node.create({
      data: {
        name,
        type,
        projectId: project.id,
        projectName: project.name,
        branch: 'main',
        version: '1.0.0',
        relativePath: 'src/index.ts',
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 10,
        meta: {},
      },
    })
  }

  describe('getNodeDependencyGraph', () => {
    it('should return orthogonal graph for nodes', async () => {
      // Create test data
      const p = await createProject('p1')
      const n1 = await createNode(p, 'n1', 'NamedExport')
      const n2 = await createNode(p, 'n2', 'NamedImport')

      // n2 -> n1
      await prisma.connection.create({
        data: { fromId: n2.id, toId: n1.id },
      })

      const graphJson = await getNodeDependencyGraph(n2.id, { depth: 5 })
      const graph = JSON.parse(graphJson)

      expect(graph.vertices).toHaveLength(2)
      expect(graph.edges).toHaveLength(1)

      const v1 = graph.vertices.find((v: any) => v.data.id === n1.id)
      expect(v1).toBeDefined()
      // n1 is target, so inDegree 1, outDegree 0
      expect(v1?.inDegree).toBe(1)
      expect(v1?.firstIn).not.toBe(-1)

      const v2 = graph.vertices.find((v: any) => v.data.id === n2.id)
      expect(v2).toBeDefined()
      // n2 is source, so outDegree 1, inDegree 0
      expect(v2?.outDegree).toBe(1)
      expect(v2?.firstOut).not.toBe(-1)
    })
  })

  describe('getProjectLevelDependencyGraph', () => {
    it('should return project graph without cycles for single project', async () => {
      // Create Project P1, P2
      const p1 = await createProject('P1')
      const p2 = await createProject('P2')

      const n1 = await createNode(p1, 'N1', 'NamedExport')
      const n2 = await createNode(p2, 'N2', 'NamedImport')

      // P2 (N2) -> P1 (N1)
      await prisma.connection.create({ data: { fromId: n2.id, toId: n1.id } })

      // Cycle: P1 -> P2
      const n3 = await createNode(p1, 'N3', 'NamedImport')
      const n4 = await createNode(p2, 'N4', 'NamedExport')
      await prisma.connection.create({ data: { fromId: n3.id, toId: n4.id } })

      const arrayBuffer = await getProjectLevelDependencyGraph(p1.id, 'main', { depth: 5 })
      const graphJson = Buffer.from(arrayBuffer as ArrayBuffer).toString('utf-8')
      const graph = JSON.parse(graphJson)

      expect(graph.vertices).toHaveLength(2) // P1, P2
      expect(graph.edges).toHaveLength(2) // P1->P2, P2->P1

      // Single project queries no longer detect cycles (performance optimization)
      // cycles field may be undefined or empty array
      expect(graph.cycles?.length || 0).toBe(0)
    })

    it('should fetch all project graphs with wildcard *', async () => {
      const p1 = await createProject('P1')
      const p2 = await createProject('P2')
      const p3 = await createProject('P3')

      const n1 = await createNode(p1, 'n1', NodeType.NamedExport)
      const n2 = await createNode(p2, 'n2', NodeType.NamedExport)
      const n3 = await createNode(p3, 'n3', NodeType.NamedExport)

      // Connect P1 -> P2
      await prisma.connection.create({
        data: { fromId: n1.id, toId: n2.id },
      })

      const arrayBuffer = await getProjectLevelDependencyGraph('*', 'main')
      const json = Buffer.from(arrayBuffer as ArrayBuffer).toString('utf-8')
      const parsedResult = JSON.parse(json)

      expect(Array.isArray(parsedResult)).toBe(true)

      // We expect at least these graphs
      const g1 = parsedResult.find((g: any) => g.vertices.some((v: any) => v.data.name === 'P1'))
      expect(g1).toBeDefined()

      const g3 = parsedResult.find((g: any) => g.vertices.some((v: any) => v.data.name === 'P3'))
      expect(g3).toBeDefined()
      expect(g3.vertices.length).toBe(1)
    })
  })
})
