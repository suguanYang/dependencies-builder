-- CreateTable
CREATE TABLE "GitRepo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "GitRepo_name_key" ON "GitRepo"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GitRepo_host_key" ON "GitRepo"("host");

-- CreateIndex
CREATE INDEX "GitRepo_host_idx" ON "GitRepo"("host");

-- CreateIndex
CREATE INDEX "GitRepo_enabled_idx" ON "GitRepo"("enabled");
