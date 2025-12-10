import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '../database/prisma'
import { getNodeDependencyGraph, getProjectLevelDependencyGraph } from './index'
import { NodeType } from '../generated/prisma/client'

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
    it('should return project graph and detect cycles', async () => {
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

      const graphJson = await getProjectLevelDependencyGraph(p1.id, 'main', { depth: 5 })
      const graph = JSON.parse(graphJson)

      expect(graph.vertices).toHaveLength(2) // P1, P2
      expect(graph.edges).toHaveLength(2) // P1->P2, P2->P1

      expect(graph.cycles).toBeDefined()
      expect(graph.cycles.length).toBeGreaterThan(0)

      const cycle = graph.cycles[0]
      // Cycle should be [ {id:..., ...}, ... ]
      expect(cycle.length).toBe(3)
      // cycle[0] should equal cycle[2] in terms of ID
      expect(cycle[0].id).toBe(cycle[2].id)

      const ids = cycle.map((n: any) => n.id)
      expect(ids).toContain(p1.id)
      expect(ids).toContain(p2.id)

      // Check metadata
      expect(cycle[0].name).toBeDefined()
      expect(cycle[0].type).toBeDefined()
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

      const json = await getProjectLevelDependencyGraph('*', 'main')
      const result = JSON.parse(json)

      expect(Array.isArray(result)).toBe(true)

      // We expect at least these graphs
      const g1 = result.find((g: any) => g.vertices.some((v: any) => v.data.name === 'P1'))
      expect(g1).toBeDefined()

      const g3 = result.find((g: any) => g.vertices.some((v: any) => v.data.name === 'P3'))
      expect(g3).toBeDefined()
      expect(g3.vertices.length).toBe(1)
    })
  })
})
