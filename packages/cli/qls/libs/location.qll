import javascript

string getLocation(AstNode node) {
  result = node.getFile().getRelativePath() + ":" + node.getLocation().getStartLine() + ":" + node.getLocation().getStartColumn() + ":" + node.getLocation().getEndLine() + ":" + node.getLocation().getEndColumn()
}