/*
  Warnings:

  - Added the required column `endColumn` to the `Node` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endLine` to the `Node` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch" TEXT NOT NULL,
    "project" TEXT NOT NULL,
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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Node" ("branch", "createdAt", "id", "meta", "name", "project", "relativePath", "startColumn", "startLine", "type", "updatedAt", "version") SELECT "branch", "createdAt", "id", "meta", "name", "project", "relativePath", "startColumn", "startLine", "type", "updatedAt", "version" FROM "Node";
DROP TABLE "Node";
ALTER TABLE "new_Node" RENAME TO "Node";
CREATE INDEX "Node_branch_project_type_name_idx" ON "Node"("branch", "project", "type", "name");
CREATE INDEX "Node_project_branch_idx" ON "Node"("project", "branch");
CREATE INDEX "Node_type_name_idx" ON "Node"("type", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
