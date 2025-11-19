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

/**
 * Helper predicate to determine if a node is being written to.
 * It checks if the node flows into the Left-Hand Side (LHS) of an assignment.
 */
predicate isWrite(DataFlow::Node node) {
  exists(AssignExpr assign |
    // Check if the node is the direct target of an assignment
    assign.getLhs() = node.asExpr()
  )
}

from DataFlow::SourceNode globalRef, DataFlow::Node usage, string name, string type
where
  not isBuiltinGlobalVar(name) and
  // 1. Find the origin of the global variable reference
  globalRef = DataFlow::globalVarRef(name) and
  
  // 2. efficiently track this variable to find where it is used (handles local aliases)
  // .track() uses TypeTracker internally, which is much faster than TaintTracking::Global
  usage = globalRef.getALocalUse() and

  // 3. Determine if it is a Write or a Read
  if isWrite(usage)
  then type = "Write"
  else type = "Read"

select name, type, getLocation(usage.getAstNode())
