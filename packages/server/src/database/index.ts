import Database from 'better-sqlite3';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

export interface DatabaseConfig {
  path?: string;
  memory?: boolean;
}

export class DMSDatabase {
  private db: Database.Database;

  constructor(config: DatabaseConfig = {}) {
    const dbPath = config.path || join(process.cwd(), 'dms.db');
    this.db = config.memory ? new Database(':memory:') : new Database(dbPath);
    
    this.initializeDatabase();
  }

  private initializeDatabase() {
    const currentDir = fileURLToPath(new URL('.', import.meta.url));
    const schemaPath = join(currentDir, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    this.db.exec(schema);
    
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
  }

  getConnection(): Database.Database {
    return this.db;
  }

  close() {
    this.db.close();
  }

  // Utility methods for common operations
  beginTransaction() {
    this.db.exec('BEGIN TRANSACTION');
  }

  commitTransaction() {
    this.db.exec('COMMIT');
  }

  rollbackTransaction() {
    this.db.exec('ROLLBACK');
  }

  // Prepared statement utilities
  prepareStatement(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }
}