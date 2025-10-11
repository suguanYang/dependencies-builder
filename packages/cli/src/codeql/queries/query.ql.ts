export const entryExportsQuery = `
/**
 * @name Named Exports from index.tsx
 * @description This query finds all exports from the entry files and outputs
 *              the export name, relative path, start line and column.
 * @kind table
 * @id js/entry-exports
 * @tags summary
 */

import javascript
import libs.exportAnalysis

from string entry, string name, string location
where
  $$entryQuery$$
select entry, name, location
`

export const callChainQuery = `
/**
 * @name universal call graph(include React render tree)
 * @description This query is used to build a render tree
 * @kind table
 * @id js/call-graph-universal
 * @tags summary
 */

import javascript
import libs.callStack

from CallAbleNode parent, CallAbleNode leaf, string path
where
  $$filter$$ and
  isLeaf(leaf) and
  calls+(parent, leaf) and
  callStack(parent, leaf, path)
select path
`