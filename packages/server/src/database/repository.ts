import { DatabaseManager } from './manager';
import { Node, Edge, NodeQuery, EdgeQuery, PaginatedResponse } from '../dependency/types';
import { randomUUID } from 'node:crypto';

export class NodeRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  async getNodes(query: NodeQuery): Promise<PaginatedResponse<Node>> {
    const connection = this.dbManager.getConnection();
    
    let whereClauses: string[] = [];
    const params: any[] = [];

    if (query.project) {
      whereClauses.push('project = ?');
      params.push(query.project);
    }
    if (query.branch) {
      whereClauses.push('branch = ?');
      params.push(query.branch);
    }
    if (query.type !== undefined) {
      whereClauses.push('type = ?');
      params.push(query.type);
    }
    if (query.name) {
      whereClauses.push('name = ?');
      params.push(query.name);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    // Get total count
    const countStmt = connection.prepare(`SELECT COUNT(*) as total FROM nodes ${where}`);
    const total = countStmt.get(...params)?.total || 0;

    // Get paginated data
    const dataStmt = connection.prepare(
      `SELECT * FROM nodes ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
    );
    const data = dataStmt.all(...params, limit, offset);

    return {
      data: data.map((node: any) => ({
        ...node,
        meta: node.meta ? JSON.parse(node.meta) : undefined
      })),
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  async getNodeById(id: string): Promise<Node | null> {
    const connection = this.dbManager.getConnection();
    const stmt = connection.prepare('SELECT * FROM nodes WHERE id = ?');
    const node = stmt.get(id) as any;
    
    if (!node) return null;

    return {
      ...node,
      meta: node.meta ? JSON.parse(node.meta) : undefined
    };
  }

  async createNode(node: Omit<Node, 'id' | 'createdAt' | 'updatedAt'>): Promise<Node> {
    const connection = this.dbManager.getConnection();
    const id = randomUUID();
    
    const stmt = connection.prepare(`
      INSERT INTO nodes (id, branch, project, version, type, name, relativePath, startLine, startColumn, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      node.branch,
      node.project,
      node.version,
      node.type,
      node.name,
      node.relativePath,
      node.startLine,
      node.startColumn,
      node.meta ? JSON.stringify(node.meta) : null
    );

    const createdNode = await this.getNodeById(id);
    if (!createdNode) {
      throw new Error('Failed to create node');
    }

    return createdNode;
  }

  async updateNode(id: string, updates: Partial<Node>): Promise<Node | null> {
    const connection = this.dbManager.getConnection();
    
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.branch !== undefined) {
      fields.push('branch = ?');
      params.push(updates.branch);
    }
    if (updates.project !== undefined) {
      fields.push('project = ?');
      params.push(updates.project);
    }
    if (updates.version !== undefined) {
      fields.push('version = ?');
      params.push(updates.version);
    }
    if (updates.type !== undefined) {
      fields.push('type = ?');
      params.push(updates.type);
    }
    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.relativePath !== undefined) {
      fields.push('relativePath = ?');
      params.push(updates.relativePath);
    }
    if (updates.startLine !== undefined) {
      fields.push('startLine = ?');
      params.push(updates.startLine);
    }
    if (updates.startColumn !== undefined) {
      fields.push('startColumn = ?');
      params.push(updates.startColumn);
    }
    if (updates.meta !== undefined) {
      fields.push('meta = ?');
      params.push(updates.meta ? JSON.stringify(updates.meta) : null);
    }

    if (fields.length === 0) {
      return this.getNodeById(id);
    }

    fields.push('updatedAt = CURRENT_TIMESTAMP');
    params.push(id);

    const stmt = connection.prepare(`
      UPDATE nodes SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...params);
    return this.getNodeById(id);
  }

  async deleteNode(id: string): Promise<boolean> {
    const connection = this.dbManager.getConnection();
    const stmt = connection.prepare('DELETE FROM nodes WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

export class EdgeRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  async getEdges(query: EdgeQuery): Promise<PaginatedResponse<Edge>> {
    const connection = this.dbManager.getConnection();
    
    let whereClauses: string[] = [];
    const params: any[] = [];

    if (query.fromId) {
      whereClauses.push('fromId = ?');
      params.push(query.fromId);
    }
    if (query.toId) {
      whereClauses.push('toId = ?');
      params.push(query.toId);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    // Get total count
    const countStmt = connection.prepare(`SELECT COUNT(*) as total FROM edges ${where}`);
    const total = countStmt.get(...params)?.total || 0;

    // Get paginated data
    const dataStmt = connection.prepare(
      `SELECT * FROM edges ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
    );
    const data = dataStmt.all(...params, limit, offset);

    return {
      data: data as Edge[],
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  async createEdge(fromId: string, toId: string): Promise<Edge> {
    const connection = this.dbManager.getConnection();
    
    const id = randomUUID();
    const stmt = connection.prepare('INSERT INTO edges (id, fromId, toId) VALUES (?, ?, ?)');
    
    stmt.run(id, fromId, toId);
    
    return {
      id,
      fromId,
      toId,
      createdAt: new Date()
    };
  }

  async deleteEdge(id: string): Promise<boolean> {
    const connection = this.dbManager.getConnection();
    const stmt = connection.prepare('DELETE FROM edges WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  async deleteEdgesByFrom(fromId: string): Promise<boolean> {
    const connection = this.dbManager.getConnection();
    const stmt = connection.prepare('DELETE FROM edges WHERE fromId = ?');
    const result = stmt.run(fromId);
    return result.changes > 0;
  }
}