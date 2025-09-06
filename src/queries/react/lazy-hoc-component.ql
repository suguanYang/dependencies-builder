import javascript
import semmle.javascript.frameworks.React
import semmle.javascript.dataflow.DataFlow


class ComponentNode extends AstNode {
 ComponentNode() {
    // Use CodeQL's built-in React component detection (handles forwardRef, HOCs, etc.)
    this instanceof ReactComponent
    or
    // Also include functions that might not be detected as ReactComponent
    this instanceof Function and
    (
      this instanceof FunctionalComponent or
      this.(Function).getName().regexpMatch("[A-Z].*") or
      exists(VariableDeclarator vd |
        vd.getInit() = this and
        vd.getBindingPattern().(VarRef).getName().regexpMatch("[A-Z].*")
      )
    )
  }

    /**
   * Gets the display name of this component
   */
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
  }

  /**
   * Gets a unique identifier for this component including location info
   */
  string getComponentId() {
    result = this.getComponentName() + "@" + this.getFile().getBaseName() + ":" + this.getLocation().getStartLine()
  }
}

class LazyHocComponent extends VariableDeclarator {
  LazyHocComponent() {
    // This is true if the variable is initialized with a call to `lazyHoc`.
    exists(CallExpr call |
      this.getInit() = call and
      (
        call.getCallee().(VarAccess).getName() = "lazyHoc" or
        call = react().getAMemberCall("lazy").asExpr()
     )
    )
  }

  /**
   * Gets the lazyHoc call expression.
   */
  CallExpr getCall() {
    this.getInit() = result
  }

  /**
   * Gets the underlying component that is dynamically imported inside the lazyHoc call.
   */
  ComponentNode getUnderlyingComponent() {
    exists(ArrowFunctionExpr callback, DynamicImportExpr importExpr |
      // 1. Get the lazyHoc call and its first argument, which is the callback function.
      callback = this.getCall().getArgument(0) and
      // 2. Find the dynamic import() expression inside the body of the callback.
      (
        callback.getBody() = importExpr or
        importExpr = callback.getBody().getAChild*()
      ) and
      // 3. Get the imported module and its default export
      exists(DataFlow::Node defaultExport |
        defaultExport = importExpr.getImportedModule().getAnExportedValue("default") and
        // 4. The AST node of that default export should be the component we're looking for.
        result = defaultExport.getALocalSource().getAstNode()
      )
    )
  }

  /**
   * Gets the import path string from the dynamic import call.
   */
  string getImportPath() {
    exists(ArrowFunctionExpr callback, DynamicImportExpr importExpr |
      callback = this.getCall().getArgument(0) and
      (
        callback.getBody() = importExpr or
        importExpr = callback.getBody().getAChild*()
      ) and
      result = importExpr.getSource().getStringValue()
    )
  }
}

from LazyHocComponent lazyComp, ComponentNode underlyingComp, string importPath
where 
  underlyingComp = lazyComp.getUnderlyingComponent() and
  importPath = lazyComp.getImportPath()
select underlyingComp.getComponentName(), underlyingComp.getLocation().toString() , importPath
