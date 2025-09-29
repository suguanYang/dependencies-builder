import javascript
import semmle.javascript.dataflow.TaintTracking
import semmle.javascript.Promises

string getLocation(AstNode node) {
  result = node.getFile().getRelativePath() + ":" + node.getLocation().getStartLine() + ":" + node.getLocation().getStartColumn()
}

class DynamicImportSourceNode extends DataFlow::Node {
  DynamicImportSourceNode() {
    this = DataFlow::moduleMember("@seeyon/global", "dynamicImport")
    or
    this = DataFlow::globalVarRef("SeeyonGlobal").getAPropertyRead("dynamicImport")
  }
}

module DynamicImportTrackingConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof DynamicImportSourceNode
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      sink = call.getCalleeNode()
    )
  }
}

module ExportOriginFlow                   = TaintTracking::Global<DynamicImportTrackingConfig>;

from DataFlow::CallNode dynamicImportCall, string packageName, string subPackageName, string namedImport, string namedImportLoc
where
  exists(DataFlow::Node source |
    ExportOriginFlow::flow(source, dynamicImportCall.getCalleeNode()) and
    packageName = dynamicImportCall.getArgument(0).getStringValue() and
    if (exists(dynamicImportCall.getArgument(2)))
    then subPackageName = dynamicImportCall.getArgument(2).getStringValue()
    else subPackageName = "Nil"
  )
  and
  if (exists(DataFlow::Node res, DataFlow::PropRead pr |
      PromiseFlow::loadStep(dynamicImportCall, res, Promises::valueProp()) and
      pr.getBase().getALocalSource().flowsTo(res)
    ))
  then
    exists(DataFlow::Node res, DataFlow::PropRead pr |
      PromiseFlow::loadStep(dynamicImportCall, res, Promises::valueProp()) and
      pr.getBase().getALocalSource().flowsTo(res) and
      namedImport = pr.getPropertyName() and
      namedImportLoc = getLocation(pr.getAstNode())
    )
  else (
    namedImport = "Nil" and namedImportLoc = getLocation(dynamicImportCall.getAstNode())
  )
select namedImportLoc, packageName, subPackageName, namedImport