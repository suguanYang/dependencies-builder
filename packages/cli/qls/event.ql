import libs.location
import javascript
import semmle.javascript.dataflow.TaintTracking
import semmle.javascript.Promises


// eventOn,
//   eventOnOnce,
//   eventEmit,
//   eventEmitAsyncResult,
//   eventEmitBroadcast,
class EventSourceNode extends DataFlow::Node {
  string type;

  EventSourceNode() {
    (
        (
            this = DataFlow::globalVarRef("SeeyonGlobal").getAPropertyRead("eventOn")
            or
            this = DataFlow::moduleMember("@seeyon/global", "eventOn")
        )
        and
        type = "eventOn"
    )
    or
    (
        (
            this = DataFlow::globalVarRef("SeeyonGlobal").getAPropertyRead("eventOnOnce")
            or
            this = DataFlow::moduleMember("@seeyon/global", "eventOnOnce")
        )
        and
        type = "eventOn"
    )
    or
    (
        (
            this = DataFlow::globalVarRef("SeeyonGlobal").getAPropertyRead("eventEmit")
            or
            this = DataFlow::moduleMember("@seeyon/global", "eventEmit")
        )
        and
        type = "eventEmit"
    )
    or
    (
        (
            this = DataFlow::globalVarRef("SeeyonGlobal").getAPropertyRead("eventEmitAsyncResult")
            or
            this = DataFlow::moduleMember("@seeyon/global", "eventEmitAsyncResult")
        )
        and
        type = "eventEmit"
    )
    or
    (
        (
            this = DataFlow::globalVarRef("SeeyonGlobal").getAPropertyRead("eventEmitBroadcast")
            or
            this = DataFlow::moduleMember("@seeyon/global", "eventEmitBroadcast")
        )
        and
        type = "eventEmit"
    )
  }

  string getType() { result = type }
}

module EventTrackingConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof EventSourceNode
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      sink = call.getCalleeNode()
    )
  }
}

module EventOriginFlow                   = TaintTracking::Global<EventTrackingConfig>;

from DataFlow::CallNode eventCall,string usageLocation, string eventName, string eventType
where
  exists(DataFlow::Node source |
    EventOriginFlow::flow(source, eventCall.getCalleeNode()) and
    eventName = eventCall.getArgument(0).getStringValue() and
    eventType = source.(EventSourceNode).getType()
    and
    usageLocation = getLocation(eventCall.getAstNode())
  )
select eventName, eventType, usageLocation