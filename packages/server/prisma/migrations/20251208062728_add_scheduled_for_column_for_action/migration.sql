-- AlterTable
ALTER TABLE "Action" ADD COLUMN "scheduledFor" DATETIME;

-- CreateTable
CREATE TABLE "Lock" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Action_status_scheduledFor_idx" ON "Action"("status", "scheduledFor");
