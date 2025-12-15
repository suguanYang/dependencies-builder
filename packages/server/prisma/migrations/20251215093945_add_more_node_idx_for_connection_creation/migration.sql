-- DropIndex
DROP INDEX "idx_node_export_match";

-- DropIndex
DROP INDEX "idx_node_import_match";

-- CreateIndex
CREATE INDEX "idx_scan_named_imports" ON "Node"("type", "import_pkg", "import_name", "branch", "projectName", "id");

-- CreateIndex
CREATE INDEX "idx_scan_dynamic_imports" ON "Node"("type", "import_pkg", "import_subpkg", "import_name", "branch", "projectName", "id");

-- CreateIndex
CREATE INDEX "idx_lookup_named_exports" ON "Node"("projectName", "branch", "name", "type", "id", "export_entry");

-- CreateIndex
CREATE INDEX "idx_lookup_federation_exports" ON "Node"("projectName", "branch", "export_entry", "type", "id");

-- CreateIndex
CREATE INDEX "idx_join_generics" ON "Node"("name", "branch", "type", "projectName", "id");
