-- AlterTable
ALTER TABLE "Node" ADD COLUMN "export_entry" TEXT;
ALTER TABLE "Node" ADD COLUMN "import_name" TEXT;
ALTER TABLE "Node" ADD COLUMN "import_pkg" TEXT;
ALTER TABLE "Node" ADD COLUMN "import_subpkg" TEXT;

-- CreateIndex
CREATE INDEX "idx_node_import_match" ON "Node"("import_pkg", "import_name", "import_subpkg");

-- CreateIndex
CREATE INDEX "idx_node_export_match" ON "Node"("projectName", "export_entry");
