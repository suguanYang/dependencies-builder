export const entryExportsQuery = `
/**
 * @name Named Exports from index.tsx
 * @description This query finds all exports from the entry files and outputs
 *              the export name, relative path, start line and column.
 * @kind table
 * @id js/entry-exports
 * @tags summary
 */

import javascript
import semmle.javascript.ES2015Modules

// Find the specific index.tsx file by relative path
// Based on Files.qll (File class) and usages in PrintAst.qll: getRelativePath()
predicate isIndexFile(File f) {
  $$entryQuery$$
}

// Use a single enumeration over all export declarations in the module file
// and derive exported names either from explicit specifiers or via exportsAs
// which also covers BulkReExportDeclaration.
from ExportDeclaration exportDecl, File f, string name, DataFlow::Node src, string location, string entry
where
  exportDecl.getEnclosingModule().getFile() = f and
  isIndexFile(f) and
  not exportDecl.isTypeOnly() and
  // Two ways to get exported names:
  // 1) From explicit specifiers (ExportSpecifier) — covers named/default exports and named re-exports.
  // 2) From exportsAs(...) for bulk re-exports (and generally works for all), constrained to bulk re-exports here
  (
    exists(ExportSpecifier spec |
      spec.getExportDeclaration() = exportDecl and
      name = spec.getExportedName() and
      src = exportDecl.getSourceNode(name)
    )
    or
      (
        exportDecl instanceof BulkReExportDeclaration and
      // Enumerate names re-exported by export * from 'a'
      exportDecl.exportsAs(_, name) and
      // Map each exported name to its defining node in the original module
      src = exportDecl.getSourceNode(name)
      )
  ) and
// Extract location and path from the resolved AST node
location = src.getTopLevel().getFile().getRelativePath() + ":" + src.getAstNode().getLocation().getStartLine()  + ":" + src.getAstNode().getLocation().getStartColumn() and
entry = f.getRelativePath()

select entry, name, location
`