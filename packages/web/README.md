## The Dependecy Manager Server
A server to store the dependencies graph data and provide the API for the dependencies management.

### The database
SQlite, by only store project-level dependencies in the central database, this simplify the query for dependecy-graph in a relation database.
And it also supports raw json column for the metadata property.

#### Schemas
The main data structure is the dependency graph, which is a directed graph, the nodes are the dependencies, the edges are the dependencies between the nodes.

### Node Table
```json
{
  "id": "", // uuid
  "branch": "", // branch name
  "project": "", // project name
  "version": "", // version number

  "type": "", // NamedExport | NamedImport | RuntimeDynamicImport | Externals | GlobalState | Events | DynamicModuleFederationReference...
  "description": "", // A description for the dependency
  "meta": { // metadata info for the dependecy, mainly consists of AST info for the database, used and generated for the query
    "location": {
        "file": "",
        "line": "",
        "column": "",
    },
  }
}
```

### Edge Table
```json
{
  "id": "", // uuid
  "source": "",
  "target": "",
}
```

### The API
- get the depdency nodes
/GET /nodes
/GET /nodes/:id
/POST /nodes
/PUT /nodes/:id 
/DELETE /nodes/:id

- get the dependency edges
/GET /edges
/GET /edges/:id
/POST /edges
/PUT /edges/:id
/DELETE /edges/:id

- get the dependency graph by project name
/GET /dependencies/:project

- create a action
/POST /actions  ## this should invoke the cli to run the static analysis
/GET /actions/:id  ## this should get the action status
/DELETE /actions/:id  ## this should delete the action

- get action result
/GET /actions/:id/result

### The framework
Fastify, performant, easy to use, good DX
