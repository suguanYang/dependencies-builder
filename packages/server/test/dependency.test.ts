import { describe, it, expect } from 'vitest'
import {
  getFullDependencyGraph,
  getProjectDependencyGraph,
  validateEdgeCreation
} from '../src/dependency'
import { mockNodes, mockConnections, mockDependencyGraph, mockProjectGraph } from './__mocks__/test-data'
import { NodeType } from '../src/generated/prisma'

describe('Dependency Module', () => {
  it('getFullDependencyGraph - should build dependency graph from nodes and connections', () => {
    const graph = getFullDependencyGraph(mockNodes, mockConnections)

    expect(graph.vertices).toHaveLength(3)
    expect(graph.edges).toHaveLength(2)
    expect(graph.vertices[0].data.name).toBe('exportedFunction')
    expect(graph.vertices[1].data.name).toBe('importedFunction')
    expect(graph.edges[0].data.fromId).toBe('node-2')
    expect(graph.edges[0].data.toId).toBe('node-1')
  })

  it('getProjectDependencyGraph - should build project-specific dependency graph', () => {
    const graph = getProjectDependencyGraph('test-project', 'main', mockNodes, mockConnections)

    expect(graph.vertices).toHaveLength(2)
    expect(graph.edges).toHaveLength(1)

    // Verify all nodes belong to the specified project and branch
    graph.vertices.forEach(vertex => {
      expect(vertex.data.project).toBe('test-project')
      expect(vertex.data.branch).toBe('main')
    })
  })

  it('validateEdgeCreation - should validate compatible node types', () => {
    const fromNode = {
      id: 'node-1',
      name: 'importedFunc',
      type: 'NamedImport' as NodeType,
      project: 'test-project',
      branch: 'main'
    }
    const toNode = {
      id: 'node-2',
      name: 'exportedFunc',
      type: 'NamedExport' as NodeType,
      project: 'test-project',
      branch: 'main'
    }

    const isValid = validateEdgeCreation(fromNode, toNode)
    expect(isValid).toBe(true)
  })

  it('validateEdgeCreation - should reject incompatible node types', () => {
    const fromNode = {
      id: 'node-1',
      name: 'importedFunc',
      type: 'NamedImport' as NodeType,
      project: 'test-project',
      branch: 'main'
    }
    const toNode = {
      id: 'node-2',
      name: 'importedFunc',
      type: 'NamedImport' as NodeType,
      project: 'test-project',
      branch: 'main'
    }

    const isValid = validateEdgeCreation(fromNode, toNode)
    expect(isValid).toBe(false)
  })

  it('validateEdgeCreation - should validate EventOn to EventEmit connection', () => {
    const fromNode = {
      id: 'node-1',
      name: 'eventListener',
      type: 'EventOn' as NodeType,
      project: 'test-project',
      branch: 'main'
    }
    const toNode = {
      id: 'node-2',
      name: 'eventEmitter',
      type: 'EventEmit' as NodeType,
      project: 'test-project',
      branch: 'main'
    }

    const isValid = validateEdgeCreation(fromNode, toNode)
    expect(isValid).toBe(true)
  })
})