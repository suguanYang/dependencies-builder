/**
 * @name React Render Tree
 * @description This query is used to find the render tree of a React component.
 * @kind diagnostic
 * @problem.severity recommendation
 * @id js/react-render-tree
 * @tags maintainability
 */

import javascript
import semmle.javascript.frameworks.React
import semmle.javascript.dataflow.DataFlow

class ReactJsxElement extends JsxElement {
    ComponentNode component;
  
    ReactJsxElement() { component.getAComponentCreatorReference().flowsToExpr(this.getNameExpr()) }
  
    /**
     * Gets the component this element instantiates.
     */
    ComponentNode getComponent() { result = component }
}

class FunctionNode extends Function {

  private DataFlow::SourceNode getADeclaredReference(DataFlow::TypeTracker t) {
    t.start() and
    result = DataFlow::valueNode(this)
    or
    exists(DataFlow::TypeTracker t2 | result = this.getADeclaredReference(t2).track(t2, t))
  }

  DataFlow::SourceNode getADeclaredReference() {
    result = this.getADeclaredReference(DataFlow::TypeTracker::end())
  }
}

private predicate alwaysReturnsJsxOrReactElements(Function f) {
  forex(Expr e |
    e.flow().(DataFlow::SourceNode).flowsToExpr(f.getAReturnedExpr()) and
    // Allow returning string constants in addition to JSX/React elemnts.
    not exists(e.getStringValue())
  |
    e instanceof JsxNode or
    e instanceof ReactElementDefinition
  )
}

predicate isReactComponent(AstNode node) {
    node instanceof ReactComponent
    or
    // Also include functions that might not be detected as ReactComponent
    node instanceof Function and
    (
        node instanceof FunctionalComponent or
        node.(Function).getName().regexpMatch("[A-Z].*")
    )
}

class ComponentNode extends AstNode {
    ComponentNode() {
        // Use CodeQL's built-in React component detection (handles forwardRef, HOCs, etc.)
        isReactComponent(this) or
        // NO NEED to check the underlying component
        // we are assuming that the argument of the forwardRef or lazy function is a React component
        this instanceof LazyComponent or
        this instanceof ForwardRefComponent or
        this instanceof HocComponent
    }


    string getComponentName() {
      // For Function nodes that are not ReactComponent
      this instanceof Function and
      (
        result = this.(Function).getName() or
        exists(VariableDeclarator vd |
          vd.getInit() = this and
          result = vd.getBindingPattern().(VarRef).getName()
        )
      )
      or
      // For other ReactComponents, try to get name from variable declarations
      this instanceof ReactComponent and
      exists(VariableDeclarator vd |
        DataFlow::valueNode(vd.getInit()).getALocalSource() = this.(ReactComponent).getComponentCreatorSource() and
        result = vd.getBindingPattern().(VarRef).getName()
      )
      or
      this instanceof LazyComponent and
      (
        exists(VariableDeclarator vd |
          vd.getInit() = this and
          result = "lazy:" + vd.getBindingPattern().(VarRef).getName())
        or
        result = "lazy:" + this.(LazyComponent).getUnderlyingComponent().(Function).getName()
      )
      or
      (
        this instanceof ForwardRefComponent and
        (
          exists(VariableDeclarator vd |
            vd.getInit() = this and
            result = "forwardRef:" + vd.getBindingPattern().(VarRef).getName())
          or 
          result = "forwardRef:" + this.(ForwardRefComponent).getUnderlyingComponent().(Function).getName()
        )
      ) or
      (
        this instanceof HocComponent and
        (
          exists(VariableDeclarator vd |
            vd.getInit() = this and
            result = "hoc:" + vd.getBindingPattern().(VarRef).getName())
          or
          result = "hoc:" + this.(HocComponent).getUnderlyingComponent().(Function).getName()
        )
      )
      or
      (
        not exists(result) and result = this.toString() + "@anonymous:" + this.getLocation().getFile().getAbsolutePath() + ":" + this.getLocation().getStartLine()
      )
    }

    string getComponentId() {
      result = this.getComponentName() + "@" + this.getFile().getBaseName() + ":" + this.getLocation().getStartLine()
    }

    DataFlow::SourceNode getAComponentCreatorReference() {
        (this instanceof ReactComponent or this instanceof FunctionalComponent) and
        result = this.(ReactComponent).getAComponentCreatorReference() or
        result = this.(LazyComponent).getAComponentCreatorReference() or
        result = this.(ForwardRefComponent).getAComponentCreatorReference() or
        result = this.(HocComponent).getAComponentCreatorReference()
    }

}

class LazyComponent extends CallExpr {
    LazyComponent() {
        this.getCallee().(VarAccess).getName() = "lazyHoc" or
        this = react().getAMemberCall("lazy").asExpr()
    }
 
    /**
     * Gets the underlying component that is dynamically imported inside the lazyHoc call.
     */
    ComponentNode getUnderlyingComponent() {
      exists(ArrowFunctionExpr callback, DynamicImportExpr importExpr |
        // 1. Get the lazyHoc call and its first argument, which is the callback function.
        callback = this.getArgument(0) and
        // 2. Find the dynamic import() expression inside the body of the callback.
        (
            callback.getBody() = importExpr or
            importExpr = callback.getBody().getAChild*()
        ) and
        // We must check for the `.then()` case FIRST.
        if
          // IF: The import is the receiver of a `.then()` call...
          exists(MethodCallExpr thenCall |
            thenCall.getReceiver() = importExpr and
            thenCall.getMethodName() = "then"
          )
        then
          // THEN: Execute the special logic to look inside the `.then()` callback.
          // the node write to the default property of the returned object is the component
          exists(MethodCallExpr thenCall, ArrowFunctionExpr thenCallback |
            thenCall.getReceiver() = importExpr and
            thenCall.getMethodName() = "then" and
            thenCallback = thenCall.getArgument(0) and
            exists(DataFlow::ObjectLiteralNode returnedObj, DataFlow::PropWrite defaultWrite |
              returnedObj = thenCallback.getAReturnedExpr().flow().getALocalSource() and
              defaultWrite = returnedObj.getAPropertyWrite("default") and
              exists(string namedExportName, DataFlow::PropRead pr |
                pr = defaultWrite.getRhs().getALocalSource() and
                namedExportName = pr.getPropertyName() and
                exists(ComponentNode comp |
                  comp.getAComponentCreatorReference().flowsTo(pr) and
                  result = comp
                )
              )
            )
          )
        else
          // ELSE: If and only if there is NO `.then()` call, fall back to the simple case.
          exists(DataFlow::Node defaultExport |
            defaultExport = importExpr.getImportedModule().getAnExportedValue("default") and
            exists(ComponentNode comp |
              comp.getAComponentCreatorReference().flowsTo(defaultExport.getALocalSource()) and
              result = comp
            )
          )
      )
    }

    private DataFlow::SourceNode getAComponentCreatorReference(DataFlow::TypeTracker t) {
      t.start() and
      result = DataFlow::valueNode(this)
      or
      exists(DataFlow::TypeTracker t2 | result = this.getAComponentCreatorReference(t2).track(t2, t))
    }

    DataFlow::SourceNode getAComponentCreatorReference() {
      result = this.getAComponentCreatorReference(DataFlow::TypeTracker::end())
    }
}
/**
 * A React component wrapped with React.forwardRef.
 * Based on HigherOrderComponentStep pattern from React.qll:801
 */
class ForwardRefComponent extends CallExpr {
    ForwardRefComponent() {
        this = react().getAMemberCall("forwardRef").asExpr()
    }

    /**
     * Gets the underlying functional component inside the forwardRef call.
     */
    Function getUnderlyingComponent() {
        // The first argument to forwardRef is the component function
        exists(FunctionNode comp |
          comp.getADeclaredReference().flowsTo(this.getArgument(0).flow().getALocalSource()) and
          result = comp
        )
    }

    /**
     * Gets a reference to the component creator for data flow tracking.
     * Follows the same pattern as LazyComponent.getAComponentCreatorReference
     */
    private DataFlow::SourceNode getAComponentCreatorReference(DataFlow::TypeTracker t) {
      t.start() and
      result = DataFlow::valueNode(this)
      or
      exists(DataFlow::TypeTracker t2 | result = this.getAComponentCreatorReference(t2).track(t2, t))
    }

    DataFlow::SourceNode getAComponentCreatorReference() {
      result = this.getAComponentCreatorReference(DataFlow::TypeTracker::end())
    }
}

class HocFunction extends Function {
  HocFunction() {
    exists(this.getParameter(0)) and
    (
      this.getName().regexpMatch("[A-Z].*")
    )
  }
}

class HocComponent extends CallExpr {
  HocComponent() {
    exists(ComponentNode comp |
      comp.getAComponentCreatorReference().flowsTo(this.getArgument(0).flow().getALocalSource())
    )
  }
  
  /**
   * Gets the actual component returned by the HOC function call
   */
  ComponentNode getUnderlyingComponent() {
      // The HOC call returns a component - follow data flow to find what it returns
      exists(FunctionNode calleeFunc, ComponentNode comp |
          calleeFunc.getADeclaredReference().flowsTo(this.getCallee().flow().getALocalSource()) and
          // the returned component should defined in the function body
          comp.getAComponentCreatorReference().flowsTo(calleeFunc.getAReturnedExpr().flow().getALocalSource()) and
          // calleeFunc.getAReturnedExpr().flow().getALocalSource().getAstNode() = comp and
          result = comp
      )
  }

  /**
   * Gets the component passed to the HOC function
   */
  ComponentNode getPassedComponent() {
    exists(ComponentNode comp |
      comp.getAComponentCreatorReference().flowsTo(this.getArgument(0).flow().getALocalSource()) and
      result = comp
    )
  }

  /**
   * Gets a reference to the component creator for data flow tracking
   */
  private DataFlow::SourceNode getAComponentCreatorReference(DataFlow::TypeTracker t) {
      t.start() and
      result = DataFlow::valueNode(this)
      or
      exists(DataFlow::TypeTracker t2 | result = this.getAComponentCreatorReference(t2).track(t2, t))
  }
  
  DataFlow::SourceNode getAComponentCreatorReference() {
      result = this.getAComponentCreatorReference(DataFlow::TypeTracker::end())
  }
}

/**
 * Gets the function that implements this component (if it's a functional component)
 */
Function getComponentFunction(ComponentNode c) {
  c instanceof ReactComponent and result = c.(ReactComponent).getInstanceMethod("render")
  or
  c instanceof Function and result = c
  or
  exists(LazyComponent lazyComp |
    lazyComp = c and
    result = getComponentFunction(lazyComp.getUnderlyingComponent())
  )
  or
  exists(ForwardRefComponent forwardRefComp |
    forwardRefComp = c and
    result = forwardRefComp.getUnderlyingComponent()
  )
  or
  exists(HocComponent hoc |
    hoc = c and
    result = hoc.getUnderlyingComponent()
  )
}

/**
 * Holds if the `parent` component statically renders the `child` component.
 */
predicate renders(ComponentNode parent, ComponentNode child) {
  // Direct JSX element rendering - use ReactJsxElement (extends JsxElement) to get component
  // Based on React.qll:559-567 - ReactJsxElement class has getComponent() method
  exists(ReactJsxElement jsx |
    jsx.getComponent() = child and
    jsx.getEnclosingFunction*() = getComponentFunction(parent)
  )
  or
  exists(HocComponent hoc |
    hoc = parent and
    exists(ComponentNode passedComp |
      hoc.getPassedComponent() = passedComp and
      passedComp = child
    )
  )
}

/**
 * Recursively builds the render path from a starting component to an ending component.
 * Uses component names for readability but unique IDs for cycle detection.
 */
predicate renderPath(ComponentNode parent, ComponentNode child, string path) {
  // Base case: A direct render relationship.
  renders(parent, child) and
  path = parent.getComponentId() + " -> " + child.getComponentId()
  or
  // Recursive step: Extend an existing path with one more render step.
  exists(ComponentNode mid, string parentPath |
    renderPath(parent, mid, parentPath) and
    renders(mid, child) and
    // Prevent cycles using component IDs for accurate detection
    not parentPath.matches("%" + child.getComponentId() + "%") and
    path = parentPath + " -> " + child.getComponentId()
  )
}

/**
 * A "leaf" component is one that does not render any other known components.
 */
predicate isLeaf(ComponentNode c) {
  not exists(ComponentNode child | renders(c, child))
}

from ComponentNode parent, ComponentNode leaf, string path
where
  parent.getComponentName() = "hoc:WrapperAttachment" and
  isLeaf(leaf) and
  renders+(parent, leaf) and
  renderPath(parent, leaf, path)
select path
