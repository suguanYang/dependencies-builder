/**
 * @name Find all Read/Write references to global variables
 * @description This query finds all references to global variables and
 * classifies them as a "Read" or "Write" access.
 * @kind table
 * @id js/global-var-access
 * @tags maintainability
 */

import javascript
import libs.location
import libs.builtInGlobalVars

private predicate isAssignToGlobalVar(DataFlow::Node source) {
  exists(AssignExpr ass |
    ass.getLhs().flow() = source
  )
}

from DataFlow::Node globalRef, string name, string type
where
  not isBuiltinGlobalVar(name) and
  globalRef = DataFlow::globalVarRef(name) and
  if (isAssignToGlobalVar(globalRef))
  then type = "Write"
  else type = "Read"
select name, type, getLocation(globalRef.getAstNode())
