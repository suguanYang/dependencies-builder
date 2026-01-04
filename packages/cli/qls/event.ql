import libs.location
import javascript
import semmle.javascript.dataflow.TaintTracking
import semmle.javascript.Promises
import libs.callStack


private class EventSourceNode extends DataFlow::Node {
  string type;

  EventSourceNode() {
    (
        (
            this = DataFlow::globalVarRef("CompanyGlobal").getAPropertyRead("eventOn")
            or
            this = DataFlow::moduleMember("@company/global", "eventOn")
        )
        and
        type = "eventOn"
    )
    or
    (
        (
            this = DataFlow::globalVarRef("CompanyGlobal").getAPropertyRead("eventOnOnce")
            or
            this = DataFlow::moduleMember("@company/global", "eventOnOnce")
        )
        and
        type = "eventOn"
    )
    or
    (
        (
            this = DataFlow::globalVarRef("CompanyGlobal").getAPropertyRead("eventEmit")
            or
            this = DataFlow::moduleMember("@company/global", "eventEmit")
        )
        and
        type = "eventEmit"
    )
    or
    (
        (
            this = DataFlow::globalVarRef("CompanyGlobal").getAPropertyRead("eventEmitAsyncResult")
            or
            this = DataFlow::moduleMember("@company/global", "eventEmitAsyncResult")
        )
        and
        type = "eventEmit"
    )
    or
    (
        (
            this = DataFlow::globalVarRef("CompanyGlobal").getAPropertyRead("eventEmitBroadcast")
            or
            this = DataFlow::moduleMember("@company/global", "eventEmitBroadcast")
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
    if (eventType = "eventOn" and exists(CallAbleNode handler |
        handler.getACreatorReference().flowsTo(eventCall.getArgument(1).getALocalSource())
    )) then
        exists(CallAbleNode handler |
            handler.getACreatorReference().flowsTo(eventCall.getArgument(1).getALocalSource()) and
            usageLocation = getLocation(handler)
        )
    else
        usageLocation = getLocation(eventCall.getAstNode())
  )
select eventName, eventType, usageLocation