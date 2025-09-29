import javascript
import semmle.javascript.dataflow.TaintTracking
import libs.builtInGlobalVars

string getLocation(AstNode node) {
  result = node.getFile().getRelativePath() + ":" + node.getLocation().getStartLine() + ":" + node.getLocation().getStartColumn()
}

module GlobalVarRefTrackingConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
     exists(string name |
       source = DataFlow::globalVarRef(name)
       and not isBuiltinGlobalVar(name)
     )
  }

  predicate isSink(DataFlow::Node sink) {
    any()
  }
}

module GlobalVarRefFlow = TaintTracking::Global<GlobalVarRefTrackingConfig>;

predicate isAssignToGlobalVar(DataFlow::Node source) {
  exists(AssignExpr ass |
    ass.getLhs().flow() = source
  )
}

from DataFlow::Node source, DataFlow::Node usage, string name, string type
where
  GlobalVarRefFlow::flow(source, usage)
  and
  source = DataFlow::globalVarRef(name)
  and
  if (isAssignToGlobalVar(source))
  then type = "Write"
  else type = "Read"
select name, type, getLocation(usage.getAstNode())