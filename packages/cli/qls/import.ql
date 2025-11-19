/**
 * @name Simple ES6 Imports from @seeyon Packages
 * @description Finds all ES6 imports from @seeyon/* packages and tracks their usage locations
 * @kind table
 * @id js/seeyon-es6-imports-simple
 * @tags imports, seeyon
 */

import javascript
import libs.location

from string packageName, string importedMember, DataFlow::Node usage
where
  // 1. Filter for packages matching @seeyon/%
  packageName.matches("@seeyon/%") and

  // 2. Use API Graphs to find the import and specific member
  // This handles 'import { X }', 'import X' (default), and 'import * as N; N.X' automatically.
  exists(API::Node pkg | 
    pkg = API::moduleImport(packageName) and
    usage = pkg.getMember(importedMember).getAValueReachableFromSource()
  )
select packageName, importedMember, getLocation(usage.getAstNode())