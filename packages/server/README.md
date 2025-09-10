## The Dependecy Manager Server
A server to store the dependencies graph data and provide the API for the dependencies management.

### The database
SQlite, by only store project-level dependencies in the central database, this simplify the query for dependecy-graph in a relation database.
And it also supports raw json column for the metadata property.

#### Schemas
The main data structure is the dependency graph, which is a directed graph, the nodes are the dependencies, the edges are the connection between the nodes, and its directed. A Node can be a dependency or a dependent, so the Nodes are usually paired with the Edges, if A import(depends) B, then A is the `from` and B is the `to`.

### Node Table
```json
{
  "id": "", // uuid, primary key
  "branch": "", // branch name, index
  "project": "", // project name, index
  "version": "", // version number

  "type": 0, // 0: NamedExport | 1: NamedImport | 2: RuntimeDynamicImport | 3: Externals | 4: GlobalState | 5: EventOn | 6: EventEmit | 7: DynamicModuleFederationReference..., index
  "name": "", // The name of the dependency, index
  // usally a Node that consider to be a 'from' Node, it may has multiple locations, since a Project may has multiple files that import the same dependency
  "relativePath": "", // the relative path to the project root
  "startLine": 0, // the start line number
  "startColumn": 0, // the start column number
   // metadata info for the dependecy, mainly consists of AST info for the codebase, used and generated from the codeql query, this should be a json column
  "meta": {
  }
}
```
composite index: (branch, project, type, name)

### Edge Table
```json
{
  "id": "", // uuid
  "from": "", // source id, foreign key to the Node table
  "to": "", // target id, foreign key to the Node table
}
```

### The API
#### The depdency nodes
- /GET /nodes?project=:project&branch=:branch&type=:type&name=:name...$limit=:limit&offset=:offset
Get Nodes that match the query parameters
- /POST /nodes
Create a Node if there is no existing one(determined by the project, branch, type, name and location)
Especially, if the Node is a `to` Node like NamedExport, EventEmit, etc, it should only has 1 location
- /PUT /nodes/:id
update the Node
- /DELETE /nodes/:id
Delete a Node if it exists(determined by the id)

#### The dependency edges
- /GET /edges?from=:from&to=:to$limit=:limit&offset=:offset
- /GET /edges/:id
- /POST /edges
Create an Edge if there is no existing one(determined by the from and to) and both the `from` and `to` Nodes exist.
The caller is usally the project(which has a 'from' Node) who is depends on the 'to' Node,
after it checked the existence of `to` Node, it want to declare a dependency between the 'from' and 'to' Nodes, which main goal is to
let the Project(which owns the `to` node) do not remove or change it easily, since it was used by other projects
<!-- - /PUT /edges/:id --> // there is no need to update an Edge, since the Edge is a connection between the Nodes, if the Nodes are changed, the Edge should be deleted and created again
- /DELETE /edges-by-from/:from
Delete an Edge if it exists(determined by the id)
When the client found its `from` Nodes are deleted and there exists an edge that assoicated with it, it should delete the Edge timely.
And there should no api that can delete the Edge by the `to` Node or its id, an Edges exists because there exists a dependency between the `from` and `to` Nodes
or exists before, we need to keep this as a source of truth for the dependency graph, it can not be deleted by other projects except the `from` Project! because it existence ensure that
dependecy is valid and protected.

#### get the dependency graph by a given Node
- /GET /dependencies/:node_id
Create a dependency graph by the given Node id, it will recursively get the `from` Nodes and the `to` Nodes that are connected to the given Node, using adjacency list to
process the graph.

#### create a action
- /POST /actions  ## this should invoke the cli to run the static analysis
- /GET /actions/:id  ## this should get the action status
- /DELETE /actions/:id  ## this should delete the action

#### get action result
- /GET /actions/:id/result


## Main Technical Stack
- Fastify
- SQLite(better-sqlite3)
- Typescript
- Rolldown