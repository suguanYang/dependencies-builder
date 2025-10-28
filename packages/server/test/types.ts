// Test-specific types to avoid Prisma client CommonJS/ESM issues
export enum NodeType {
  NamedExport = 'NamedExport',
  NamedImport = 'NamedImport',
  EventEmit = 'EventEmit',
  EventOn = 'EventOn',
}