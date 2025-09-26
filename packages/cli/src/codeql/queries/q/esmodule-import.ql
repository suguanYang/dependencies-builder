/**
 * @name Find Usages of Imports from @seeyon Modules
 * @description This query finds all ES6 imports from modules starting with '@seeyon/'
 * and reports the specific member used, the module it came from,
 * and the location of each usage.
 * @kind table
 * @id js/seeyon-import-usage
 * @tags maintainability
 */

import javascript
// Import the core DataFlow library for types like `DataFlow::Node` and `flowsTo`.
import semmle.javascript.dataflow.DataFlow
// Import the ES2015Modules library for types like `ImportDeclaration` and its predicates.
import semmle.javascript.ES2015Modules

/**
 * Gets a string representation of an AST node's location.
 */
private string getLocation(AstNode node) {
  result =
    node.getFile().getRelativePath() + ":" + node.getLocation().getStartLine() + ":" +
      node.getLocation().getStartColumn()
}

/**
 * A predicate that holds if `usage` is a use of an imported member from `imp`.
 * This predicate unifies the logic for default, named, and namespace imports.
 *
 * `imp` - The import declaration, e.g., `import ... from '@seeyon/a'`.
 * `memberName` - The name of the member being imported, e.g., 'default', 'yyy', or 'zzz'.
 * `usage` - The data flow node representing where the imported member is actually used.
 */
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

from Import imp, string memberName, DataFlow::Node usage
where
  // Filter for imports from modules starting with '@seeyon/'.
  imp.getImportedPathString().matches("@seeyon/%") and
  (
    // Handle static ES6 imports
    imp instanceof ImportDeclaration and
    getAnImportedMemberUsage(imp, memberName, usage)
    or
    // Handle dynamic imports - import('module').then(module => module.method())
    exists(DynamicImportExpr dynImp, CallExpr thenCall, Function callback, PropAccess propAccess |
      dynImp = imp and
      thenCall.getCallee().(PropAccess).getBase() = DataFlow::valueNode(dynImp).asExpr() and
      thenCall.getCallee().(PropAccess).getPropertyName() = "then" and
      callback = thenCall.getArgument(0) and
      propAccess.getBase().(VarAccess).getName() = callback.getParameter(0).getName() and
      memberName = propAccess.getPropertyName() and
      usage = DataFlow::valueNode(propAccess)
    )
  ) and
  // Ensure we have a valid AST node for location reporting
  exists(usage.getAstNode()) and
  // Exclude the import specifiers themselves
  not usage.getAstNode() instanceof ImportSpecifier
select imp.getImportedPathString(), memberName, getLocation(usage.getAstNode())
