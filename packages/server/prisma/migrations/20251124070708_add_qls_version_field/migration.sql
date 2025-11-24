-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "startLine" INTEGER NOT NULL,
    "startColumn" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "endColumn" INTEGER NOT NULL,
    "meta" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qlsVersion" TEXT NOT NULL DEFAULT '0.1.0',
    CONSTRAINT "Node_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Node" ("branch", "createdAt", "endColumn", "endLine", "id", "meta", "name", "projectId", "projectName", "relativePath", "startColumn", "startLine", "type", "updatedAt", "version") SELECT "branch", "createdAt", "endColumn", "endLine", "id", "meta", "name", "projectId", "projectName", "relativePath", "startColumn", "startLine", "type", "updatedAt", "version" FROM "Node";
DROP TABLE "Node";
ALTER TABLE "new_Node" RENAME TO "Node";
CREATE INDEX "Node_projectName_idx" ON "Node"("projectName");
CREATE INDEX "Node_type_idx" ON "Node"("type");
CREATE INDEX "Node_name_idx" ON "Node"("name");
CREATE INDEX "Node_branch_idx" ON "Node"("branch");
CREATE INDEX "Node_version_idx" ON "Node"("version");
CREATE INDEX "Node_qlsVersion_idx" ON "Node"("qlsVersion");
CREATE UNIQUE INDEX "Node_projectId_version_branch_relativePath_type_name_startLine_startColumn_endLine_endColumn_key" ON "Node"("projectId", "version", "branch", "relativePath", "type", "name", "startLine", "startColumn", "endLine", "endColumn");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
