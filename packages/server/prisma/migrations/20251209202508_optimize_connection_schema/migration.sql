PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Connection" (
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("fromId", "toId"),
    CONSTRAINT "Connection_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Connection_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Connection" ("createdAt", "fromId", "toId") SELECT "createdAt", "fromId", "toId" FROM "Connection";
DROP TABLE "Connection";
ALTER TABLE "new_Connection" RENAME TO "Connection";
CREATE INDEX "Connection_fromId_idx" ON "Connection"("fromId");
CREATE INDEX "Connection_toId_idx" ON "Connection"("toId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
