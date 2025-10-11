/**
 * @name Simple ES6 Imports from @seeyon Packages
 * @description Finds all ES6 imports from @seeyon/* packages and tracks their usage locations
 * @kind table
 * @id js/seeyon-es6-imports-simple
 * @tags imports, seeyon
 */

import javascript
import semmle.javascript.ES2015Modules
import semmle.javascript.dataflow.DataFlow
import libs.location

private predicate getAnImportedMemberUsage(
  ImportDeclaration imp, string memberName, DataFlow::Node usage
) {
  // Case 1: Default import -> import xxx from '...'
  exists(ImportDefaultSpecifier spec | spec.getImportDeclaration() = imp |
    memberName = "default" and
    (
      // Direct usage of the imported variable
      usage.(DataFlow::ValueNode).asExpr().(VarAccess).getName() = spec.getLocal().getName()
      or
      // Data flow through local steps
      DataFlow::valueNode(spec.getLocal()).getASuccessor+() = usage
    )
  )
  or
  // Case 2: Named import -> import { yyy } from '...'
  exists(NamedImportSpecifier spec | spec.getImportDeclaration() = imp |
    memberName = spec.getImportedName() and
    (
      // Direct usage of the imported variable
      usage.(DataFlow::ValueNode).asExpr().(VarAccess).getName() = spec.getLocal().getName()
      or
      // Data flow through local steps
      DataFlow::valueNode(spec.getLocal()).getASuccessor+() = usage
    )
  )
  or
  // Case 3: Namespace import -> import * as a from '...'; a.zzz()
  exists(ImportNamespaceSpecifier spec | spec.getImportDeclaration() = imp |
    exists(PropAccess memberExpr | 
      memberExpr.getBase().(VarAccess).getName() = spec.getLocal().getName() and
      memberName = memberExpr.getPropertyName() and
      usage = DataFlow::valueNode(memberExpr)
    )
  )
}

from ImportDeclaration imp, string packageName, string importedName, DataFlow::Node usage, string usageLocation
where
  // Filter for @seeyon/* packages
  imp.getImportedPathString().matches("@seeyon/%") and
  packageName = imp.getImportedPathString()
  and
  getAnImportedMemberUsage(imp, importedName, usage)
  and
  usageLocation = getLocation(usage.getAstNode())

select packageName, importedName, usageLocation