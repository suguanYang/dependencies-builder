import Database from 'better-sqlite3';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

export interface DatabaseConfig {
  path?: string;
  memory?: boolean;
}

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database.Database | null = null;
  private config: DatabaseConfig;

  private constructor(config: DatabaseConfig = {}) {
    this.config = config;
  }

  public static getInstance(config?: DatabaseConfig): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(config);
    }
    return DatabaseManager.instance;
  }

  public async connect(): Promise<void> {
    if (this.db) {
      return;
    }

    try {
      const dbPath = this.config.path || join(process.cwd(), 'dms.db');
      this.db = this.config.memory ? new Database(':memory:') : new Database(dbPath);
      
      this.initializeDatabase();
      
      // Enable foreign keys and WAL mode
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('journal_mode = WAL');
      
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database disconnected');
    }
  }

  public async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  public getConnection(): Database.Database {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  public isConnected(): boolean {
    return this.db !== null;
  }

  private initializeDatabase() {
    if (!this.db) return;
    
    const currentDir = fileURLToPath(new URL('.', import.meta.url));
    const schemaPath = join(currentDir, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    this.db.exec(schema);
  }

  // Transaction management
  public beginTransaction(): void {
    this.getConnection().exec('BEGIN TRANSACTION');
  }

  public commitTransaction(): void {
    this.getConnection().exec('COMMIT');
  }

  public rollbackTransaction(): void {
    this.getConnection().exec('ROLLBACK');
  }

  // Utility methods for prepared statements
  public prepare(sql: string): Database.Statement {
    return this.getConnection().prepare(sql);
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) return false;
      const result = this.db.prepare('SELECT 1 as health').get();
      return result?.health === 1;
    } catch {
      return false;
    }
  }
}