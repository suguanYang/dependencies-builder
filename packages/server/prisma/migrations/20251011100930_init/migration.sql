-- CreateTable
CREATE TABLE "Node" (
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

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Connection_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Connection_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
CREATE INDEX "Node_branch_project_type_name_idx" ON "Node"("branch", "project", "type", "name");

-- CreateIndex
CREATE INDEX "Node_project_branch_idx" ON "Node"("project", "branch");

-- CreateIndex
CREATE INDEX "Node_type_name_idx" ON "Node"("type", "name");

-- CreateIndex
CREATE INDEX "Connection_fromId_idx" ON "Connection"("fromId");

-- CreateIndex
CREATE INDEX "Connection_toId_idx" ON "Connection"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_fromId_toId_key" ON "Connection"("fromId", "toId");

-- CreateIndex
CREATE INDEX "Action_status_idx" ON "Action"("status");

-- CreateIndex
CREATE INDEX "Action_project_branch_idx" ON "Action"("project", "branch");

-- CreateIndex
CREATE INDEX "Action_type_idx" ON "Action"("type");

-- CreateIndex
CREATE INDEX "Action_createdAt_idx" ON "Action"("createdAt");
