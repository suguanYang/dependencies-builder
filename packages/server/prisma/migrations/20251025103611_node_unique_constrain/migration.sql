/*
  Warnings:

  - A unique constraint covering the columns `[projectId,version,branch,relativePath,type,name,startLine,startColumn,endLine,endColumn]` on the table `Node` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Node_projectId_version_branch_relativePath_type_name_startLine_startColumn_endLine_endColumn_key" ON "Node"("projectId", "version", "branch", "relativePath", "type", "name", "startLine", "startColumn", "endLine", "endColumn");
