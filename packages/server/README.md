## The Dependecy Manager Server
A server to store the dependencies graph data and provide the API for the dependencies management.

### The database
Store dependencies in a central database

#### Schemas
The main data structure is the dependency graph, which is a directed graph, the nodes are the dependencies, the edges are the connection between the nodes, and its directed. A Node can be a dependency or a dependent, so the Nodes are usually paired with the Edges, if A import(depends) B, then A is the `from` and B is the `to`.

### Node Table
```json
{
  "id": "", // uuid, primary key
  "branch": "", // branch name, index
  "projectName": "", // project name, index
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

### Connection Table
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

#### The dependency connections
- /GET /connections?from=:from&to=:to$limit=:limit&offset=:offset
- /GET /connections/:id
- /POST /connections
Create an Connection if there is no existing one(determined by the from and to) and both the `from` and `to` Nodes exist.
The caller is usally the project(which has a 'from' Node) who is depends on the 'to' Node,
after it checked the existence of `to` Node, it want to declare a dependency between the 'from' and 'to' Nodes, which main goal is to
let the Project(which owns the `to` node) do not remove or change it easily, since it was used by other projects
<!-- - /PUT /connections/:id --> // there is no need to update an Connection, since the Connection is a connection between the Nodes, if the Nodes are changed, the Connection should be deleted and created again
- /DELETE /connection-by-from/:from
Delete an Connection if it exists(determined by the id)
When the client found its `from` Nodes are deleted and there exists an connection that assoicated with it, it should delete the Connection timely.
And there should no api that can delete the Connection by the `to` Node or its id, an Connections exists because there exists a dependency between the `from` and `to` Nodes
or exists before, we need to keep this as a source of truth for the dependency graph, it can not be deleted by other projects except the `from` Project! because it existence ensure that
dependecy is valid and protected.

- /POST /connections/auto-create
Automatically create connections between the Nodes that are not connected, it will use the Node table to find the Nodes that are not connected, and then create the connections between them. The connections are:
1. NamedExport to NamedImport, from:projectA:NamedImport:projectB.name -> to:projectB:NamedExport:name
2. RuntimeDynamicImport to NamedExport, from:projectA:RuntimeDynamicImport:projectB.sub.name -> to:projectB:NamedExport:name
3. GlobalVarRead to GlobalVarWrite, from:projectA:GlobalVarRead:Key -> to:projectB:GlobalVarWrite:Key
4. WebStorageRead to WebStorageWrite, from:projectA:WebStorageRead:Key -> to:projectB:WebStorageWrite:Key
5. EventOn to EventEmit, from:projectA:EventOn:Key -> to:projectB:EventEmit:Key

#### get the dependency graph by a given Node
- /GET /dependencies/:node_id
Create a dependency graph by the given Node id, it will recursively get the `from` Nodes and the `to` Nodes that are connected to the given Node, using orthogonnal list to
present the graph.
  - Response:
  ```json
  {
    "vertices": [
      "data": {}, // the Node data
      "firstIn": edges_idx // the index of the first incoming edge
      "firstOut": edges_idx // the index of the first outgoing edge
    ],
    "edges": [
      {
        "data": {}, // the Connection data
        "tailvertex": vertices_idx,
        "headvertex": vertices_idx,
        "headnext": edges_idx,  // next edge with same head vertex
        "tailnext": edges_idx,  // next edge with same tail vertex
      }
    ]
  }
  ```

#### The dependency graph at the project level
- /GET /dependencies/projects/:project/:branch
  - Response:
  ```json
  {
    "vertices": [
      "node": {
        "project": "",
        "branch": ""
      }
      "firstIn": edges_idx // the index of the first incoming edge
      "firstOut": edges_idx // the index of the first outgoing edge
    ],
    "edges": [
      {
        "tailvertex": vertices_idx,
        "headvertex": vertices_idx,
        "tailLink": edges_idx, // the next edge with same tail vertex
        "headLink": edges_idx, // the next edge with same head vertex
      }
    ]
  }
  ```


#### create a action
- /POST /actions  ## this should invoke the cli to run the static analysis
- /GET /actions/:id  ## this should get the action status
- /DELETE /actions/:id  ## this should delete the action

#### get action result
- /GET /actions/:id/result


### LLM Configuration
Manage LLM settings for the system.

- /GET /llm/config
  - Get the current LLM configuration.
- /PUT /llm/config
  - Update the LLM configuration.
  - Body:
    ```json
    {
      "apiKey": "sk-...",
      "baseUrl": "https://api.openai.com/v1",
      "modelName": "gpt-4",
      "temperature": 0.7,
      "enabled": true
    }
    ```


## Main Technical Stack
- Fastify
- Typescript
- Rolldown
- Prisma
- Vitest