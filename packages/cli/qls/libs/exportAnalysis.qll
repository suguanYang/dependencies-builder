/**
 * @name Export Analysis Library
 * @description Reusable library for analyzing ES2015 module exports and their origins
 */

import location
import callStack
import javascript
import semmle.javascript.frameworks.React
import semmle.javascript.dataflow.TaintTracking

/**
 * A source node that represents potential origins for exported values.
 * This includes top-level declarations like variables, functions, classes, etc.
 */
class ExportSourceNode extends AstNode {
  ExportSourceNode() {
    this.getContainer() instanceof TopLevel
  }
}

/**
 * Data flow configuration for tracking any source to any sink at the top level.
 * This is used for general flow analysis between export sources.
 */
module AnySourceConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source.getContainer() instanceof TopLevel
  }

  predicate isSink(DataFlow::Node sink) {
    sink.getContainer() instanceof TopLevel
  }
}

/**
 * Data flow configuration for tracking sources to exported values.
 * Sources are top-level declarations, sinks are exported values.
 */
module ExportOriginConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source.getContainer() instanceof TopLevel
  }

  predicate isSink(DataFlow::Node sink) {
    exists(ExportDeclaration e | sink = e.getSourceNode(_))
  }
}

/**
 * Global data flow modules for export analysis.
 */
module ExportOriginFlow = TaintTracking::Global<ExportOriginConfig>;
module AnySourceFlow = TaintTracking::Global<AnySourceConfig>;

/**
 * Predicate to determine if a source node is the minimal origin for an export.
 * A minimal origin is one that flows to the export and has no other sources flowing into it.
 */
predicate isMinimalOriginForExport(ExportSourceNode origin, ExportDeclaration exportDecl, string name) {
  ExportOriginFlow::flow(DataFlow::valueNode(origin), exportDecl.getSourceNode(name))
  and
  not exists(ExportSourceNode other |
    other != origin and
    ExportOriginFlow::flow(DataFlow::valueNode(other), exportDecl.getSourceNode(name)) and
    AnySourceFlow::flow(DataFlow::valueNode(other), DataFlow::valueNode(origin))
  )
}

/**
 * Predicate to find the origin of an exported symbol, handling different export types.
 * This handles local exports, re-exports from internal modules, and re-exports from external modules.
 */
predicate getExportOrigin(ExportDeclaration exportDecl, string name, AstNode origin, string location) {
  exists(ExportSourceNode sourceNode |
    (
      // Handle export specifiers (both local and re-exports)
      exists(ExportSpecifier spec |
        spec.getExportDeclaration() = exportDecl and
        name = spec.getExportedName()
      )
      or
      // Handle bulk re-exports
      (
        exportDecl instanceof BulkReExportDeclaration and
        exportDecl.exportsAs(_, name)
      )
      or
      // handle namead export declaration
      (
        exportDecl instanceof ExportNamedDeclaration and
        exportDecl.(ExportNamedDeclaration).getAnExportedDecl().getName() = name
      )
      or
      // handle default export declaration
      (
        exportDecl instanceof ExportDefaultDeclaration and
        "default" = name
      )
    )
    and
    (
      // Case 1: Export has a resolvable source node (local exports or internal re-exports)
      if exists(exportDecl.getSourceNode(name).getAstNode()) then (
        isMinimalOriginForExport(sourceNode, exportDecl, name) and
        origin = sourceNode
      )
      // Case 2: Re-export from external module (source node not resolvable)
      else if exportDecl instanceof ReExportDeclaration then (
        exists(ExportSpecifier spec2, ExportNamedDeclaration namedDecl |
          spec2.getExportDeclaration().getEnclosingModule() = exportDecl.(ReExportDeclaration).getReExportedES2015Module() and
          namedDecl = spec2.getExportDeclaration() and
          name = spec2.getExportedName() and
          sourceNode = spec2 and
          origin = spec2
        )
      )
      // Case 3: Fallback to the export declaration itself
      else (
        sourceNode = exportDecl and
        origin = exportDecl
      )
    )
    and
    // Generate location string, handling LazyComponent specially
    if origin instanceof LazyComponent then
      location = getLocation(origin.(LazyComponent).getUnderlyingNode())
    else
      location = getLocation(origin)
  )
}

/**
 * Predicate to check if a file matches a specific relative path pattern.
 * This is useful for filtering exports from specific entry files.
 */
predicate isTargetFile(File f, string relativePath) {
  f.getRelativePath() = relativePath
}

/**
 * Predicate to get all exports from a specific file.
 * This combines the export detection logic with origin finding.
 */
predicate getFileExports(string filePath, string exportName, string location) {
  exists(ExportDeclaration exportDecl, File f, AstNode origin |
    exportDecl.getEnclosingModule().getFile() = f and
    isTargetFile(f, filePath) and
    not exportDecl.isTypeOnly() and
    getExportOrigin(exportDecl, exportName, origin, location)
  )
}