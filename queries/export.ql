
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
  
select entry, name, location
