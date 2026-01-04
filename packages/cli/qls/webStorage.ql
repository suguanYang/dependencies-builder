import javascript
import libs.location

private module PersistentWebStorage {
  private DataFlow::SourceNode webStorage(string kind) {
    (
        (kind = "localStorage" or kind = "sessionStorage") and
        result = DataFlow::globalVarRef(kind)
    )
    or
    (
        (
            result = DataFlow::moduleMember("@company/global", "storage")
            or
            result = DataFlow::globalVarRef("CompanyGlobal").getAPropertyRead("storage")
        )
        and
        kind = "localStorage"
    )
  }

  /**
   * A read access.
   */
  class ReadWriteAccess extends PersistentReadAccess, PersistentWriteAccess, DataFlow::CallNode {
    string kind;
    string type;

    ReadWriteAccess() {
        (
            this = webStorage(kind).getAMethodCall("getItem")
            and
            type = "Read"
        )
        or
        (
            this = webStorage(kind).getAMethodCall("setItem")
            and
            type = "Write"
        )
    }

    override PersistentWriteAccess getAWrite() {
      any()
    }   
    override DataFlow::Node getValue() { any() }

    string getKey() { this.getArgument(0).mayHaveStringValue(result) }

    string getKind() { result = kind }

    string getType() { result = type }
  }

}

from PersistentWebStorage::ReadWriteAccess readOrWrite
select readOrWrite.getKey(), readOrWrite.getType(), readOrWrite.getKind(), getLocation(readOrWrite.getAstNode())
