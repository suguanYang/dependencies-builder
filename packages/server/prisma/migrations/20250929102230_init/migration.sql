-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "project" TEXT,
    "branch" TEXT,
    "type" TEXT NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "logs" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Action_status_idx" ON "Action"("status");

-- CreateIndex
CREATE INDEX "Action_project_branch_idx" ON "Action"("project", "branch");

-- CreateIndex
CREATE INDEX "Action_type_idx" ON "Action"("type");

-- CreateIndex
CREATE INDEX "Action_createdAt_idx" ON "Action"("createdAt");
