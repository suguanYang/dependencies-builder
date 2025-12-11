import { prisma } from '../database/prisma'

export async function optimizedAutoCreateConnections(): Promise<{
  createdConnections: number
  skippedConnections: number
  errors: string[]
  cycles: string[][]
}> {
  try {
    let createdCount = 0

    // Rule 1: NamedImport -> NamedExport
    // Matches: Import(pkg=projectName, name=name) -> Export(projectName, name)
    const rule1Count = await prisma.$executeRaw`
        INSERT OR IGNORE INTO Connection (fromId, toId)
        SELECT nFrom.id, nTo.id
        FROM Node nFrom
        JOIN Node nTo ON 
            nFrom.import_pkg = nTo.projectName 
            AND nFrom.import_name = nTo.name
            AND nFrom.branch = nTo.branch
        WHERE nFrom.type = 'NamedImport' 
          AND nTo.type = 'NamedExport'
          AND nFrom.projectName != nTo.projectName;
    `
    createdCount += rule1Count

    // Rule 2: RuntimeDynamicImport -> NamedExport
    // Matches: DynImport(pkg=projectName, subpkg=entryName, name=name) -> Export(projectName, export_entry, name)
    const rule2Count = await prisma.$executeRaw`
        INSERT OR IGNORE INTO Connection (fromId, toId)
        SELECT nFrom.id, nTo.id
        FROM Node nFrom
        JOIN Node nTo ON 
            nFrom.import_pkg = nTo.projectName 
            AND nFrom.import_subpkg = nTo.export_entry
            AND nFrom.import_name = nTo.name
            AND nFrom.branch = nTo.branch
        WHERE nFrom.type = 'RuntimeDynamicImport' 
          AND nTo.type = 'NamedExport'
          AND nFrom.projectName != nTo.projectName;
    `
    createdCount += rule2Count

    // Rule 6: DynamicModuleFederationReference -> NamedExport
    // Matches: RemoteLoader(appName=projectName, moduleName=entryName) -> Export(projectName, export_entry)
    // Note: RemoteLoader 'import_name' maps to 'export_entry' (the exposed module name)
    const rule6Count = await prisma.$executeRaw`
        INSERT OR IGNORE INTO Connection (fromId, toId)
        SELECT nFrom.id, nTo.id
        FROM Node nFrom
        JOIN Node nTo ON 
            nFrom.import_pkg = nTo.projectName 
            AND nFrom.import_name = nTo.export_entry
            AND nFrom.branch = nTo.branch
        WHERE nFrom.type = 'DynamicModuleFederationReference' 
          AND nTo.type = 'NamedExport'
          AND nFrom.projectName != nTo.projectName;
    `
    createdCount += rule6Count

    // Generic Rules: GlobalVar, WebStorage, Event, UrlParam
    const genericCount = await prisma.$executeRaw`
        INSERT OR IGNORE INTO Connection (fromId, toId)
        SELECT nFrom.id, nTo.id
        FROM Node nFrom
        JOIN Node nTo ON 
            nFrom.name = nTo.name 
            AND nFrom.branch = nTo.branch
        WHERE 
           (
             (nFrom.type = 'GlobalVarRead' AND nTo.type = 'GlobalVarWrite') OR
             (nFrom.type = 'WebStorageRead' AND nTo.type = 'WebStorageWrite') OR
             (nFrom.type = 'EventOn' AND nTo.type = 'EventEmit') OR
             (nFrom.type = 'UrlParamRead' AND nTo.type = 'UrlParamWrite')
           )
           AND nFrom.projectName != nTo.projectName;
    `
    createdCount += genericCount

    return {
      createdConnections: createdCount,
      skippedConnections: 0, // Not tracked with INSERT OR IGNORE
      errors: [],
      cycles: [], // Cycles are computed on read-time now
    }
  } catch (error) {
    return {
      createdConnections: 0,
      skippedConnections: 0,
      errors: [`Failed to auto-create connections (SQL): ${error}`],
      cycles: [],
    }
  }
}
