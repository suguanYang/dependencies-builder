/*
  Warnings:

  - You are about to drop the column `branch` on the `Action` table. All the data in the column will be lost.
  - You are about to drop the column `project` on the `Action` table. All the data in the column will be lost.
  - Added the required column `parameters` to the `Action` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "logs" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Action" ("createdAt", "error", "id", "logs", "result", "status", "type", "updatedAt") SELECT "createdAt", "error", "id", "logs", "result", "status", "type", "updatedAt" FROM "Action";
DROP TABLE "Action";
ALTER TABLE "new_Action" RENAME TO "Action";
CREATE INDEX "Action_status_idx" ON "Action"("status");
CREATE INDEX "Action_type_idx" ON "Action"("type");
CREATE INDEX "Action_createdAt_idx" ON "Action"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
