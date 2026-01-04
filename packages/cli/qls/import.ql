import javascript
import libs.location

from string packageName, string importedMember, AstNode locationNode, string location
where
  // Global filter: Package name matches @company/%
  packageName.matches("@company/%") and
  (
    exists(API::Node pkg, DataFlow::Node usage |
      pkg = API::moduleImport(packageName) and
      (
        // Namespace Usage (import * as ns / import('pkg'))
        usage = pkg.getAValueReachableFromSource() and
        // Only classify as 'namespace' if it is syntactically a namespace import or dynamic import.
        (
          (
            usage.asExpr() instanceof DynamicImportExpr
            and
            importedMember = "namespace"
          )
          or
          exists(ImportNamespaceSpecifier s |
            (
              s.getLocal().getVariable().getAnAccess() = usage.asExpr()
              and
              importedMember = "namespace"
            )
            or
            exists(PropAccess memberExpr |
              memberExpr.getBase() = s.getLocal().getVariable().getAnAccess() and
              importedMember = memberExpr.getPropertyName() and
              usage.asExpr() = memberExpr
            )
          )
        )
        or
        // Specific Member Usage (import { x }, import x)
        exists(API::Node memberNode |
          // .getMember("default") handles `import X from 'pkg'`
          // .getMember("name") handles `import { name } from 'pkg'`
          memberNode = pkg.getMember(importedMember) and

          // Exclude internal Promise methods found on dynamic imports
          not importedMember in ["then", "catch", "finally"] and

          usage = memberNode.getAValueReachableFromSource()
        )
      )
      and
      locationNode = usage.getAstNode()
      and
      location = getLocation(locationNode)
    )
    or
    exists(ReExportDeclaration exportDecl |
      exportDecl.getImportedPath().getStringValue() = packageName
      and
      locationNode = exportDecl
      and
      (
        exists(ExportSpecifier spec |
          spec.getExportDeclaration() = exportDecl and
          importedMember = spec.getExportedName()
        )
        or
        // Handle bulk re-exports
        (
          exportDecl instanceof BulkReExportDeclaration and
          importedMember = "namespace"
        )
      )
      and
      location = getLocation(locationNode)
    )
  )
select packageName, importedMember, location
