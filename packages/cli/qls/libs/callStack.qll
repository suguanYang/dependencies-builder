
import javascript
import semmle.javascript.frameworks.React
import semmle.javascript.dataflow.DataFlow
private import semmle.javascript.dataflow.internal.PreCallGraphStep

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

class TopLevelCall extends CallExpr {
  TopLevelCall() { this.getContainer() instanceof TopLevel }

  private cached DataFlow::SourceNode getACreatorReference(DataFlow::TypeTracker t) {
    t.start() and result = DataFlow::valueNode(this)
    or
    exists(DataFlow::TypeTracker t2 | result = this.getACreatorReference(t2).track(t2, t))
  }

  cached DataFlow::SourceNode getACreatorReference() {
    result = this.getACreatorReference(DataFlow::TypeTracker::end())
  }
}

private class ObjectExpressionNode extends ObjectExpr {
  ObjectExpressionNode() { this.getContainer() instanceof TopLevel }

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
    or
    this instanceof ObjectExpressionNode
    or
    this instanceof TopLevelCall
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
    or result = this.(ObjectExpressionNode).getACreatorReference()
    or result = this.(TopLevelCall).getACreatorReference()
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
  or
  c instanceof TopLevelCall and result = c.(TopLevelCall).getContainer()
}



/**
 * Checks if a call is invoking a parameter of the enclosing function.
 * Used to prevent HOF utility functions (like cache(loader)) from statically linking
 * to all possible arguments passed to them.
 */
predicate isParameterCall(CallNode call, Function scope) {
  exists(Parameter p |
    p = scope.getAParameter() and
    DataFlow::parameterNode(p).flowsTo(DataFlow::valueNode(call.getCallee()))
  )
}

/**
 * Checks if an argument of a call flows from a parameter of the enclosing function.
 * Used to prevent HOF utility functions from linking to their parameters when passing them
 * to other functions (e.g. cache(loader) -> adapter(loader)).
 */
predicate isParameterArgument(CallNode call, int i, Function scope) {
  exists(Parameter p |
    p = scope.getAParameter() and
    DataFlow::parameterNode(p).flowsTo(DataFlow::valueNode(call.getArgument(i)))
  )
}

cached predicate calls(CallAbleNode parent, CallAbleNode child) {
  // direct function-like call
  exists(CallNode call |
    call.getEnclosingFunction*() = getFunction(parent) and
    call.getCalleeNode() = child and
    // FIXHOC: Exclude calls to parameters (e.g. cache(loader) -> loader())
    not isParameterCall(call, getFunction(parent))
  )
  or
  // higher-order function
  exists(CallNode call, int i |
    call.getEnclosingFunction*() = getFunction(parent) and
    child = call.getArgumentFunctionNode(i) and
    // FIXHOC: Exclude arguments that are parameters (e.g. cache(loader) -> adapter(loader))
    // We don't want cache -> loader_implementation just because it passes loader to adapter.
    not isParameterArgument(call, i, getFunction(parent))
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
  or
  // Object properties
  exists(Property prop |
    parent = prop.getObjectExpr() and
    child.getACreatorReference().flowsToExpr(prop.getInit())
  )
  or
  // Top-Level Call Dependencies (HOC wrapper chains)
  // Outer(Inner) -> Outer wraps Inner
  exists(TopLevelCall parentCall, int i |
    parent = parentCall and
    // child is an argument to the parent call
    child.getACreatorReference().flowsToExpr(parentCall.getArgument(i))
  )
}

/**
 * A "leaf" component is one that does not render any other known components.
 */
cached predicate isLeaf(CallAbleNode c) {
  not exists(CallAbleNode child | calls(c, child))
}