import javascript
import semmle.javascript.frameworks.React
import semmle.javascript.dataflow.DataFlow
private import semmle.javascript.dataflow.internal.PreCallGraphStep

// Helper for React.lazy and lazyHoc; resolves the underlying component including `.then(() => ({default: m.X}))`
class LazyComponent extends CallExpr {
  LazyComponent() {
    this.getCallee().(VarAccess).getName() = "lazyHoc" or
    this.getCallee().(VarAccess).getName() = "LazyHoc" or
    this = react().getAMemberCall("lazy").asExpr()
  }

  CallAbleNode getUnderlyingNode() {
    exists(ArrowFunctionExpr callback, DynamicImportExpr importExpr |
      callback = this.getArgument(0) and
      (
        callback.getBody() = importExpr or
        importExpr = callback.getBody().getAChild*()
      ) and
      // handle `.then(() => ({ default: m.X }))`
      if exists(MethodCallExpr thenCall | thenCall.getReceiver() = importExpr and thenCall.getMethodName() = "then")
      then
        exists(MethodCallExpr thenCall, ArrowFunctionExpr thenCallback, DataFlow::ObjectLiteralNode returnedObj, DataFlow::PropWrite defaultWrite, DataFlow::PropRead pr |
          thenCall.getReceiver() = importExpr and
          thenCall.getMethodName() = "then" and
          thenCallback = thenCall.getArgument(0) and
          returnedObj = thenCallback.getAReturnedExpr().flow().getALocalSource() and
          defaultWrite = returnedObj.getAPropertyWrite("default") and
          pr = defaultWrite.getRhs().getALocalSource() and
          exists(CallAbleNode node |
            node.getACreatorReference().flowsTo(pr) and
            result = node
          )
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

  private DataFlow::SourceNode getACreatorReference(DataFlow::TypeTracker t) {
    t.start() and result = DataFlow::valueNode(this)
    or exists(DataFlow::TypeTracker t2 | result = this.getACreatorReference(t2).track(t2, t))
  }

  DataFlow::SourceNode getACreatorReference() { result = this.getACreatorReference(DataFlow::TypeTracker::end()) }
}

private class ReactJsxElement extends JsxElement {
  CallAbleNode component;

  ReactJsxElement() { component.getACreatorReference().flowsToExpr(this.getNameExpr()) }

  /**
   * Gets the component this element instantiates.
   */
  CallAbleNode getComponent() { result = component }
}

// JSX element whose tag resolves to a LazyComponent; exposes its underlying node
private class JsxLazyElement extends JsxElement {
  LazyComponent lc;

  JsxLazyElement() { lc.getACreatorReference().flowsToExpr(this.getNameExpr()) }

  CallAbleNode getUnderlying() { result = lc.getUnderlyingNode() }
}

private class FunctionNode extends Function {
  // Only include functions defined at the top level
  FunctionNode() {
    this.getEnclosingContainer() instanceof TopLevel and
    not this.inExternsFile() 
  }

  private DataFlow::SourceNode getACreatorReference(DataFlow::TypeTracker t) {
    t.start() and result = DataFlow::valueNode(this)
    or exists(DataFlow::TypeTracker t2 | result = this.getACreatorReference(t2).track(t2, t)) // track
  }

  DataFlow::SourceNode getACreatorReference() { result = this.getACreatorReference(DataFlow::TypeTracker::end()) }
}

class CallAbleNode extends AstNode { // AstNode base from many QL classes
  CallAbleNode() {
    // Prefer a single representation:
    // - Functional components appear as FunctionNode (avoid duplicate ReactComponent view)
    // - Class components appear as ReactComponent (they are not Function)
    this instanceof FunctionNode
    or
    this instanceof ReactComponent
  }

  // resolve variable declarator name when assigned
  // Source: Expr.qll VariableDeclarator, Variables.qll VarRef/BindingPattern
  string getNameByVarDecl() {
    exists(VariableDeclarator vd | // VariableDeclarator from Expr.qll/Stmt.qll
      vd.getInit() = this and // initializer equals this node
      result = vd.getBindingPattern().(VarRef).getName() // VarRef.getName from Variables.qll
    )
  }

  // prefer declarator name, else function name, else synthesized anonymous id
  // Source: Functions.qll getName(); Location APIs from common AST
  string getName() {
    if exists(this.getNameByVarDecl()) then
      result = this.getNameByVarDecl()
    else if this instanceof Function and
            exists(string fn | fn = this.(Function).getName() and not fn = "") then
      result = this.(Function).getName()
    else
      // fallback: base name from file + line:col as stable id, avoiding plain "anonymous"
      result = "anonymous"
  }

  // unique id for cycle detection and path readability
  string getId() {
    result = this.getName() + "@ " + this.getFile().getRelativePath() + ":" + this.getLocation().getStartLine() + ":" + this.getLocation().getStartColumn()
  }

  // unify creator-reference access across different underlying kinds
  // Source: React.qll getAComponentCreatorReference; our wrappers expose similar
  DataFlow::SourceNode getACreatorReference() {
    result = this.(ReactComponent).getAComponentCreatorReference()
    or result = this.(FunctionNode).getACreatorReference()
    // or result = this.(LazyComponent).getACreatorReference()
    // or result = this.(ForwardRefComponent).getACreatorReference()
  }
}

private class CallNode extends CallExpr { // CallExpr from Expr.qll
  FunctionNode resolved;

  CallNode() {
    resolved.getACreatorReference().flowsToExpr(this.getCallee())
  }

  // Getter for our resolved callable callee (avoid overriding any base API)
  FunctionNode getCalleeNode() { result = resolved }

  /**
   * Gets an argument of this call that is a top-level function.
   */
  FunctionNode getArgumentFunctionNode(int i) {
    exists(FunctionNode fn |
      fn.getACreatorReference().flowsTo(this.getArgument(i).flow().getALocalSource()) and
      result = fn
    )
  }
}

private Function getFunction(CallAbleNode c) {
  c instanceof ReactComponent and result = c.(ReactComponent).getInstanceMethod("render")
  or c instanceof Function and result = c
}

predicate calls(CallAbleNode parent, CallAbleNode child) {
  // direct function-like call within parent's function
  exists(CallNode call | // our helper wrapper
    call.getEnclosingFunction*() = getFunction(parent) and
    call.getCalleeNode() = child
  )
  or
  // higher-order function: parent passes a function argument to some callee
  exists(CallNode call |
    call.getEnclosingFunction*() = getFunction(parent) and
    child = call.getArgumentFunctionNode(_)
  )
  or
  // direct JSX element rendering within parent's function
  exists(ReactJsxElement jsx |
    jsx.getEnclosingFunction*() = getFunction(parent) and
    jsx.getComponent() = child
  )
  or
  // JSX element rendering a LazyComponent; use its underlying node as the child
  exists(JsxLazyElement jx |
    jx.getEnclosingFunction*() = getFunction(parent) and
    jx.getUnderlying() = child
  )
}

/**
 * Recursively builds the render path from a starting component to an ending component.
 * Uses component names for readability but unique IDs for cycle detection.
 */
predicate callStack(CallAbleNode parent, CallAbleNode child, string path) {
  // base edge
  calls(parent, child) and path = parent.getId() + " -> " + child.getId()
  or
  // recursive extension with cycle check via string containment
  exists(CallAbleNode mid, string parentPath |
    callStack(parent, mid, parentPath) and // transitive
    calls(mid, child) and // extend
    not parentPath.matches("%" + child.getId() + "%") and // cycle guard
    path = parentPath + " -> " + child.getId()
  )
}

/**
 * A "leaf" component is one that does not render any other known components.
 */
predicate isLeaf(CallAbleNode c) { // leaf if no outgoing calls
  not exists(CallAbleNode child | calls(c, child))
}
