/**
 * @name URL Parameter Usage
 * @description Detects URL parameter reads and writes using dataflow tracking.
 * Tracks parameters from sources (location.search, getSearchParams) through the codebase.
 * @kind table
 * @id js/url-param-usage
 * @tags maintainability
 */

import javascript
import libs.location

// ============================================================================
// URL PARAMETER READ PATTERNS
// ============================================================================

/**
 * Pattern 1: getSearchParams() from @company/global
 * Usage: getSearchParams('key') or getSearchParams()
 */
class GetSearchParamsRead extends DataFlow::Node {
  string paramKey;
  string type;
  
  GetSearchParamsRead() {
    exists(DataFlow::CallNode call |
      (
        call = DataFlow::moduleMember("@company/global", "getSearchParams").getACall() or
        call = DataFlow::globalVarRef("CompanyGlobal").getAPropertyRead("getSearchParams").getACall()
      ) and
      this = call and
      (
        // With key argument
        paramKey = call.getArgument(0).getStringValue()
        or
        // Without argument - returns all params
        not exists(call.getArgument(0)) and paramKey = "*"
      ) and
      type = "UrlParamRead"
    )
  }
  
  string getParamKey() { result = paramKey }
  string getType() { result = type }
}

/**
 * Pattern 2: new URLSearchParams().get('key')
 */
class URLSearchParamsRead extends DataFlow::Node {
  string paramKey;
  string type;
  
  URLSearchParamsRead() {
    exists(DataFlow::MethodCallNode call |
      call.getMethodName() = "get" and
      exists(DataFlow::NewNode newNode |
        newNode.asExpr().(NewExpr).getCalleeName() = "URLSearchParams" and
        newNode.flowsTo(call.getReceiver())
      ) and
      paramKey = call.getArgument(0).getStringValue() and
      this = call and
      type = "UrlParamRead"
    )
  }
  
  string getParamKey() { result = paramKey }
  string getType() { result = type }
}

/**
 * Pattern 3: location.search.includes('key')
 */
class LocationSearchIncludesRead extends DataFlow::Node {
  string paramKey;
  string type;
  
  LocationSearchIncludesRead() {
    exists(DataFlow::MethodCallNode call |
      call.getMethodName() = "includes" and
      exists(DataFlow::PropRead searchProp |
        searchProp.getPropertyName() = "search" and
        (
          searchProp.getBase().asExpr().(GlobalVarAccess).getName() = "location" or
          searchProp.getBase().(DataFlow::PropRead).getPropertyName() = "location"
        ) and
        searchProp.flowsTo(call.getReceiver())
      ) and
      this = call and
      exists(string arg |
        arg = call.getArgument(0).getStringValue() and
        // Extract param from patterns like "key=" or "?key"
        paramKey = arg.replaceAll("=.*", "").replaceAll("\\?", "")
      ) and
      type = "UrlParamRead"
    )
  }
  
  string getParamKey() { result = paramKey }
  string getType() { result = type }
}

// ============================================================================
// URL PARAMETER WRITE PATTERNS (TAINT TRACKING)
// ============================================================================

/**
 * Configuration to track string literals flowing into URL sinks
 */
class UrlParamWriteConfig extends TaintTracking::Configuration {
  UrlParamWriteConfig() { this = "UrlParamWriteConfig" }

  override predicate isSource(DataFlow::Node source) {
    // Source is any string literal that looks like a query param
    exists(string val |
      val = source.asExpr().(StringLiteral).getValue() and
      (
        // Contains '?' indicating start of query string
        val.matches("%?%") 
        or
        // OR contains '=' indicating a parameter pair (e.g. "pageOpenMode=create")
        val.matches("%=%")
      )
    )
  }

  override predicate isSink(DataFlow::Node sink) {
    // Sink 1: jsSdk.router.push({url: SINK})
    exists(MethodCallExpr call |
      (call.getMethodName() = "push" or call.getMethodName() = "openTabWindow") and
      exists(PropAccess receiver |
        receiver = call.getReceiver() and
        receiver.getPropertyName() = "router" and
        (
          receiver.getBase().(PropAccess).getPropertyName() = "jsSdk" or
          receiver.getBase().(GlobalVarAccess).getName() = "jsSdk"
        )
      ) and
      exists(ObjectExpr obj, Property urlProp |
        obj = call.getArgument(0) and
        urlProp = obj.getPropertyByName("url") and
        sink.asExpr() = urlProp.getInit()
      )
    )
    or
    // Sink 2: OpenWindow(SINK)
    exists(DataFlow::CallNode call |
      (
        call.getCalleeName() = "OpenWindow" or
        call.getCalleeName() = "OpenChildFrameWindow" or
        call.getCalleeName() = "openWindow" or
        call = DataFlow::moduleMember("@company/global", "OpenWindow").getACall() or
        call = DataFlow::moduleMember("@company/global", "openWindow").getACall() or
        call = DataFlow::globalVarRef("CompanyGlobal").getAPropertyRead("OpenWindow").getACall()
      ) and
      sink = call.getArgument(0)
    )
    or
    // Sink 3: history.push(SINK)
    exists(MethodCallExpr call |
      (call.getMethodName() = "push" or call.getMethodName() = "replace") and
      call.getReceiver().(VarAccess).getName() = "history" and
      sink.asExpr() = call.getArgument(0)
    )
    or
    // Sink 4: history.pushState(..., SINK)
    exists(MethodCallExpr call |
      (call.getMethodName() = "pushState" or call.getMethodName() = "replaceState") and
      (
        call.getReceiver().(GlobalVarAccess).getName() = "history" or
        call.getReceiver().(PropAccess).getPropertyName() = "history"
      ) and
      sink.asExpr() = call.getArgument(2)
    )
    or
    // Sink 5: location.href = SINK
    exists(Assignment assign |
      assign.getLhs().(PropAccess).getPropertyName() = "href" and
      (
        assign.getLhs().(PropAccess).getBase().(GlobalVarAccess).getName() = "location" or
        assign.getLhs().(PropAccess).getBase().(PropAccess).getPropertyName() = "location"
      ) and
      sink.asExpr() = assign.getRhs()
    )
    or
    // Sink 6: location.assign(SINK)
    exists(MethodCallExpr call |
      (call.getMethodName() = "assign" or call.getMethodName() = "replace") and
      (
        call.getReceiver().(GlobalVarAccess).getName() = "location" or
        call.getReceiver().(PropAccess).getPropertyName() = "location"
      ) and
      sink.asExpr() = call.getArgument(0)
    )
  }
}

class UrlParamWrite extends DataFlow::Node {
  string paramName;
  string type;
  
  UrlParamWrite() {
    exists(UrlParamWriteConfig config, DataFlow::Node source, DataFlow::Node sink |
      config.hasFlow(source, sink) and
      this = source and
      type = "UrlParamWrite" and
      // Extract param from the SOURCE string
      exists(string val |
        val = source.asExpr().(StringLiteral).getValue() and
        (
          // Case 1: Contains '?' -> extract suffix
          if val.matches("%?%") then
            paramName = val.suffix(val.indexOf("?") + 1)
          // Case 2: No '?' but contains '=' -> assume it's a param string (e.g. "key=value")
          else
            paramName = val
        )
      )
    )
  }
  
  string getParamName() { result = paramName }
  string getType() { result = type }
}

// ============================================================================
// QUERY OUTPUT
// ============================================================================

from DataFlow::Node node, string paramName, string type
where
  // READ patterns
  (
    exists(GetSearchParamsRead read |
      read = node and
      paramName = read.getParamKey() and
      type = read.getType()
    )
    or
    exists(URLSearchParamsRead read |
      read = node and
      paramName = read.getParamKey() and
      type = read.getType()
    )
    or
    exists(LocationSearchIncludesRead read |
      read = node and
      paramName = read.getParamKey() and
      type = read.getType()
    )
  )
  or
  // WRITE patterns (Taint Tracking)
  (
    exists(UrlParamWrite write |
      write = node and
      paramName = write.getParamName() and
      type = write.getType()
    )
  ) and
  paramName != ""
select paramName, type, getLocation(node.asExpr())
