import javascript

private module PersistentWebStorage {
  private DataFlow::SourceNode webStorage(string kind) {
    (
        (kind = "localStorage" or kind = "sessionStorage") and
        result = DataFlow::globalVarRef(kind)
    )
    or
    (
        (
            result = DataFlow::moduleMember("@seeyon/global", "storage")
            or
            result = DataFlow::globalVarRef("SeeyonGlobal").getAPropertyRead("storage")
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

string getLocation(DataFlow::Node node) {
  result = node.getAstNode().getFile().getRelativePath() + ":" + node.getAstNode().getLocation().getStartLine() + ":" + node.getAstNode().getLocation().getStartColumn()
}

from PersistentWebStorage::ReadWriteAccess readOrWrite
select readOrWrite.getKey(), getLocation(readOrWrite), readOrWrite.getType(), readOrWrite.getKind()
