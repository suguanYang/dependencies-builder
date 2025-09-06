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
        this instanceof LazyComponent and
        isReactComponent(this.(LazyComponent).getUnderlyingComponent()) or
        // NO NEED to check the underlying component of ForwardRefComponent
        // we are assuming that the argument of the forwardRef function is a React component
        this instanceof ForwardRefComponent
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
        (
          exists(VariableDeclarator vd |
            vd.getInit() = this and
            result = vd.getBindingPattern().(VarRef).getName())
          or
          result = "lazy:" + this.(LazyComponent).getUnderlyingComponent().(Function).getName()
        )
      )
      or
      (
        this instanceof ForwardRefComponent and
        (
          exists(VariableDeclarator vd |
            vd.getInit() = this and
            result = vd.getBindingPattern().(VarRef).getName())
          or 
          result = "forwardRef:" + this.(ForwardRefComponent).getUnderlyingComponent().(Function).getName()
        )
      ) or
      (
        not exists(result) and result = this.getLocation().getFile().getAbsolutePath() + ":" + this.getLocation().getStartLine()
      )
    }

    string getComponentId() {
      result = this.getComponentName() + "@" + this.getFile().getBaseName() + ":" + this.getLocation().getStartLine()
    }

    DataFlow::SourceNode getAComponentCreatorReference() {
        (this instanceof ReactComponent or this instanceof FunctionalComponent) and
        result = this.(ReactComponent).getAComponentCreatorReference() or
        result = this.(LazyComponent).getAComponentCreatorReference() or
        result = this.(ForwardRefComponent).getAComponentCreatorReference()
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
    AstNode getUnderlyingComponent() {
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
                exists(DataFlow::Node namedExport |
                  namedExport = importExpr.getImportedModule().getAnExportedValue(namedExportName) and
                  result = namedExport.getALocalSource().getAstNode()
                )
              )
            )
          )
        else
          // ELSE: If and only if there is NO `.then()` call, fall back to the simple case.
          exists(DataFlow::Node defaultExport |
            defaultExport = importExpr.getImportedModule().getAnExportedValue("default") and
            result = defaultExport.getALocalSource().getAstNode()
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
    AstNode getUnderlyingComponent() {
        // The first argument to forwardRef is the component function
        result = this.getArgument(0).flow().getALocalSource().getAstNode()
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

// Function that returns a new Component
// class HocComponent extends CallExpr {
//   HocComponent() {
//     this.getArgument(0) instanceof ComponentNode
//   }

//   AstNode getUnderlyingComponent() {
//     // get the actual component that returned by the function
//     // its return value should be a ComponentNode that defined or accessed in the function
//     result = this.flow().getALocalSource().getAstNode()
//   }
// }

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
  // and
  // exists(HocComponent hoc |
  //   hoc.getArgument(0) = child
  // )
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
  parent.getComponentName() = "Attachment" and
  isLeaf(leaf) and
  renders+(parent, leaf) and
  renderPath(parent, leaf, path)
select "Render path: " + path, parent.getComponentName()
