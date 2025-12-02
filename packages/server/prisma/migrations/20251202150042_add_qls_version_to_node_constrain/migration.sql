/*
  Warnings:

  - A unique constraint covering the columns `[projectId,branch,relativePath,type,name,startLine,startColumn,endLine,endColumn,qlsVersion]` on the table `Node` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Node_projectId_branch_relativePath_type_name_startLine_startColumn_endLine_endColumn_key";

-- CreateIndex
CREATE UNIQUE INDEX "Node_projectId_branch_relativePath_type_name_startLine_startColumn_endLine_endColumn_qlsVersion_key" ON "Node"("projectId", "branch", "relativePath", "type", "name", "startLine", "startColumn", "endLine", "endColumn", "qlsVersion");
