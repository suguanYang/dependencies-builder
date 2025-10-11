import javascript
import semmle.javascript.dataflow.TaintTracking
import semmle.javascript.Promises
import semmle.javascript.frameworks.React

import libs.location

private class ReactJsxElement extends JsxElement {
  RemoteLoaderSourceNode component;

  ReactJsxElement() { component.getSourceNode().flowsToExpr(this.getNameExpr()) }

  RemoteLoaderSourceNode getComponent() { result = component }
}

// RemotePageLoader, RemoteLoader, UDCRuntimePage, 
class RemoteLoaderSourceNode extends DataFlow::Node {
    RemoteLoaderSourceNode() {
        this = DataFlow::moduleMember("@seeyon/global", "RemotePageLoader")
        or
        this = DataFlow::moduleMember("@seeyon/global", "RemoteLoader")
        or
        this = DataFlow::moduleMember("@seeyon/global", "UDCRuntimePage")
        or
        this = DataFlow::moduleMember("@seeyon/global", "UDCRuntime")
        or
        this = DataFlow::globalVarRef("SeeyonGlobal").getAPropertyRead("RemotePageLoader")
        or
        this = DataFlow::globalVarRef("SeeyonGlobal").getAPropertyRead("RemoteLoader")
        or
        this = DataFlow::globalVarRef("SeeyonGlobal").getAPropertyRead("UDCRuntimePage")
        or
        this = DataFlow::globalVarRef("SeeyonGlobal").getAPropertyRead("UDCRuntime")
    }

    DataFlow::SourceNode getSourceNode() { result = this }
}

module RemoteLoaderTrackingConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
        source instanceof RemoteLoaderSourceNode
    }

  predicate isSink(DataFlow::Node sink) {
        exists(ReactJsxElement jsx |
            sink = jsx.getComponent()
        )
    }
}

module RemoteLoaderOriginFlow                   = TaintTracking:: Global<RemoteLoaderTrackingConfig>;

from ReactJsxElement jsx, DataFlow::Node source, DataFlow::Node sink, string appName, string moduleName
where
    RemoteLoaderOriginFlow::flow(source, sink)
    and
    sink = jsx.getComponent()
    and
    appName = jsx.getAttributeByName("appName").getStringValue()
    and
    (
      moduleName = jsx.getAttributeByName("module").getStringValue()
      or
      moduleName = jsx.getAttributeByName("pageName").getStringValue()
    )
select appName, moduleName, getLocation(jsx)