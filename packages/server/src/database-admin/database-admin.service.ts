import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DatabaseQueryDto } from './dto/database-query.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { getAdminUserKey, revokeAdminKey } from '../auth/auth.config';

// Helper function to convert database values for JSON serialization
function convertDatabaseValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle Date objects - convert to ISO string
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle BigInt values - convert to Number
  if (typeof obj === 'bigint') {
    return Number(obj);
  }

  // Handle arrays - recursively process each element
  if (Array.isArray(obj)) {
    return obj.map(convertDatabaseValues);
  }

  // Handle objects - recursively process each property
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertDatabaseValues(value);
    }
    return result;
  }

  // Return primitive values as-is
  return obj;
}

@Injectable()
export class DatabaseAdminService {
  constructor(private prisma: PrismaService) { }

  async executeQuery(databaseQueryDto: DatabaseQueryDto) {
    try {
      const { query } = databaseQueryDto;

      if (!query || query.trim() === '') {
        throw new BadRequestException('Query is required');
      }

      const startTime = Date.now();

      try {
        // Execute the raw query using Prisma's $queryRaw
        const result = await this.prisma.$queryRawUnsafe(query);
        const executionTime = Date.now() - startTime;

        // Convert result to array format for consistent response
        const rawData = Array.isArray(result) ? result : [result];

        // Convert database values for JSON serialization
        const data = convertDatabaseValues(rawData);

        return {
          success: true,
          data,
          executionTime,
          rowCount: data.length,
        };
      } catch (dbError) {
        const executionTime = Date.now() - startTime;
        return {
          success: false,
          error: dbError instanceof Error ? dbError.message : 'Database error occurred',
          executionTime,
        };
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: 'Failed to execute database query',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getSchema() {
    try {
      // Get table information
      const tables = await this.prisma.$queryRaw`
        SELECT
          name as tableName,
          sql
        FROM
          sqlite_master
        WHERE
          type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY
          name
      `;

      // Get table row counts and convert BigInt to Number
      const tableCounts = await Promise.all(
        (tables as any[]).map(async (table: any) => {
          const countResult = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table.tableName}`);
          const rowCount = (countResult as any)[0].count;
          return {
            tableName: table.tableName,
            rowCount: Number(rowCount), // Convert BigInt to Number
          };
        })
      );

      return {
        tables: (tables as any[]).map((table, index) => ({
          ...table,
          rowCount: tableCounts[index]?.rowCount || 0,
        })),
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to fetch database schema',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTableInfo(tableName: string) {
    try {
      // Get table schema
      const rawSchema = await this.prisma.$queryRawUnsafe(`PRAGMA table_info(${tableName})`);

      // Get sample data (first 10 rows)
      const rawSampleData = await this.prisma.$queryRawUnsafe(`SELECT * FROM ${tableName} LIMIT 10`);

      // Convert database values for JSON serialization
      const schema = convertDatabaseValues(rawSchema);
      const sampleData = convertDatabaseValues(rawSampleData);

      return {
        tableName,
        schema,
        sampleData,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to fetch table information',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createApiKey(createApiKeyDto: CreateApiKeyDto) {
    try {
      const { keyName, expiresIn } = createApiKeyDto;

      if (!keyName || keyName.trim() === '') {
        throw new BadRequestException('Key name is required');
      }

      const apiKey = await getAdminUserKey(keyName, {
        expiresIn: expiresIn || undefined
      });

      return {
        success: true,
        apiKey
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: 'Failed to generate API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getApiKeys() {
    try {
      const apiKeys = await this.prisma.apikey.findMany({
        where: {
          user: {
            role: 'admin'
          }
        },
        select: {
          id: true,
          name: true,
          expiresAt: true,
          createdAt: true,
          user: {
            select: {
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return {
        success: true,
        apiKeys
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to fetch API keys',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async revokeApiKey(id: string) {
    try {
      await revokeAdminKey(id);

      return {
        success: true,
        message: 'API key revoked successfully'
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to revoke API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}