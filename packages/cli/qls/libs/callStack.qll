import javascript
import semmle.javascript.frameworks.React
import semmle.javascript.dataflow.DataFlow
private import semmle.javascript.dataflow.internal.PreCallGraphStep

/**
 * Gets the maximum path depth to explore.
 */
private int getCallStackDepthLimit() { result = 20 }

class LazyComponent extends CallExpr {
  LazyComponent() {
    this.getCallee().(VarAccess).getName() = "lazyHoc" or
    this.getCallee().(VarAccess).getName() = "LazyHoc" or
    this = react().getAMemberCall("lazy").asExpr()
  }

  private cached DynamicImportExpr getImportExpr() {
    exists(ArrowFunctionExpr callback |
      callback = this.getArgument(0) and
      (
        callback.getBody() = result or
        result = callback.getBody().getAChild*()
      )
    )
  }

  private cached ArrowFunctionExpr getThenCallback() {
    exists(MethodCallExpr thenCall |
      thenCall.getReceiver() = this.getImportExpr() and
      thenCall.getMethodName() = "then" and
      result = thenCall.getArgument(0)
    )
  }

  cached CallAbleNode getUnderlyingNode() {
    exists(DynamicImportExpr importExpr |
      importExpr = this.getImportExpr() and
      // handle `.then(() => ({ default: m.X }))`
      if exists(this.getThenCallback())
      then
        exists(ArrowFunctionExpr thenCallback, DataFlow::ObjectLiteralNode returnedObj,
          DataFlow::PropWrite defaultWrite, DataFlow::PropRead pr, CallAbleNode node
        |
          thenCallback = this.getThenCallback() and
          returnedObj = thenCallback.getAReturnedExpr().flow().getALocalSource() and
          defaultWrite = returnedObj.getAPropertyWrite("default") and
          pr = defaultWrite.getRhs().getALocalSource() and
          node.getACreatorReference().flowsTo(pr) and
          result = node
        )
      else
        // simple case: default export
        exists(DataFlow::Node defaultExport, CallAbleNode node |
          defaultExport = importExpr.getImportedModule().getAnExportedValue("default") and
          node.getACreatorReference().flowsTo(defaultExport.getALocalSource()) and
          result = node
        )
    )
  }

  private cached DataFlow::SourceNode getACreatorReference(DataFlow::TypeTracker t) {
    t.start() and result = DataFlow::valueNode(this)
    or
    exists(DataFlow::TypeTracker t2 | result = this.getACreatorReference(t2).track(t2, t))
  }

  cached DataFlow::SourceNode getACreatorReference() {
    result = this.getACreatorReference(DataFlow::TypeTracker::end())
  }
}

private class ReactJsxElement extends JsxElement {
  CallAbleNode component;

  ReactJsxElement() { component.getACreatorReference().flowsToExpr(this.getNameExpr()) }

  CallAbleNode getComponent() { result = component }
}

private class JsxLazyElement extends JsxElement {
  LazyComponent lc;

  JsxLazyElement() { lc.getACreatorReference().flowsToExpr(this.getNameExpr()) }

  cached CallAbleNode getUnderlying() { result = lc.getUnderlyingNode() }
}

private class FunctionNode extends Function {
  FunctionNode() {
    this.getEnclosingContainer() instanceof TopLevel and
    not this.inExternsFile()
  }

  private cached DataFlow::SourceNode getACreatorReference(DataFlow::TypeTracker t) {
    t.start() and result = DataFlow::valueNode(this)
    or
    exists(DataFlow::TypeTracker t2 | result = this.getACreatorReference(t2).track(t2, t))
  }

  cached DataFlow::SourceNode getACreatorReference() {
    result = this.getACreatorReference(DataFlow::TypeTracker::end())
  }
}

class CallAbleNode extends AstNode {
  CallAbleNode() {
    this instanceof FunctionNode
    or
    this instanceof ReactComponent
  }

  cached string getNameByVarDecl() {
    exists(VariableDeclarator vd |
      vd.getInit() = this and
      result = vd.getBindingPattern().(VarRef).getName()
    )
  }

  cached string getId() {
    result =
      this.getFile().getRelativePath() + ":" + this.getLocation().getStartLine() + ":" +
        this.getLocation().getStartColumn() + ":" + this.getLocation().getEndLine() + ":" +
        this.getLocation().getEndColumn()
  }

  cached DataFlow::SourceNode getACreatorReference() {
    result = this.(ReactComponent).getAComponentCreatorReference()
    or result = this.(FunctionNode).getACreatorReference()
  }
}

private class CallNode extends CallExpr {
  FunctionNode resolved;

  CallNode() {
    resolved.getACreatorReference().flowsToExpr(this.getCallee())
  }

  cached FunctionNode getCalleeNode() { result = resolved }

  cached FunctionNode getArgumentFunctionNode(int i) {
    exists(FunctionNode fn |
      fn.getACreatorReference().flowsTo(this.getArgument(i).flow().getALocalSource()) and
      result = fn
    )
  }
}

private cached Function getFunction(CallAbleNode c) {
  c instanceof ReactComponent and result = c.(ReactComponent).getInstanceMethod("render")
  or
  c instanceof Function and result = c
}

cached predicate calls(CallAbleNode parent, CallAbleNode child) {
  // direct function-like call
  exists(CallNode call |
    call.getEnclosingFunction*() = getFunction(parent) and
    call.getCalleeNode() = child
  )
  or
  // higher-order function
  exists(CallNode call |
    call.getEnclosingFunction*() = getFunction(parent) and
    child = call.getArgumentFunctionNode(_)
  )
  or
  // direct JSX element rendering
  exists(ReactJsxElement jsx |
    jsx.getEnclosingFunction*() = getFunction(parent) and
    jsx.getComponent() = child
  )
  or
  // JSX element rendering a LazyComponent
  exists(JsxLazyElement jx |
    jx.getEnclosingFunction*() = getFunction(parent) and
    jx.getUnderlying() = child
  )
}

/**
 * Internal recursive predicate for building the call stack with a depth limit.
 */
private predicate callStackRec(CallAbleNode parent, CallAbleNode child, string path, int len) {
  // base edge
  calls(parent, child) and
  path = parent.getId() + "->" + child.getId() and
  len = 1
  or
  // recursive extension
  exists(CallAbleNode mid, string parentPath, int parentLen |
    callStackRec(parent, mid, parentPath, parentLen) and
    calls(mid, child) and
    // *** PERFORMANCE FIX ***
    // not parentPath.matches("%" + child.getId() + "%") and
    len = parentLen + 1 and
    len <= getCallStackDepthLimit() and // *** CRASH PREVENTION ***
    path = parentPath + "->" + child.getId()
  )
}

/**
 * Recursively builds the render path from a starting component to an ending component.
 */
predicate callStack(CallAbleNode parent, CallAbleNode child, string path) {
  exists(int len |
    callStackRec(parent, child, path, len)
  )
}

/**
 * A "leaf" component is one that does not render any other known components.
 */
cached predicate isLeaf(CallAbleNode c) {
  not exists(CallAbleNode child | calls(c, child))
}