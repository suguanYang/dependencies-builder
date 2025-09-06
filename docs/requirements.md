This document will explain and introduce the new dependecies management system for frontend projects.

The DMS(dependency management system) main goal is to manage and validate on dependency breakage.

It must includes the following features:
- validation
- reporting

## What is dependency?

Code that involes 2 different **modules** will create dependency.

## What are the dependencies?
We are usually have 2 kinds of dependencies can be categorized by integration strategy, this choice dictates how the independently developed parts(micorfrontend apps) are assembled into a cohesive system. The two primary approaches are build-time integration and runtime integration.     


### 1. Build-time Integration(Static Dependencies)
1. Static ES6 Modules
2. MF webpack config

### 2. Runtime Integration(Dynamic Dependencies)
1. runtime dynamic import
2. externals(global vendros mounted on the window)
3. Global State(global variables, local storage, session storage)
3. Events
4. Runtime MF reference

### 3. The unknown dependencies

## Implementation
The implmentation is mainly consists of 2 parts:

1. Dependencies database.
2. Static analysis

### Dependencies database
The database is used for create, update and query the dependencies graph.

It main consists 2 types of data:
- Node
```json
{
  "id": "",
  "branch": "",
  "project": "@seeyon/ui",
  "revisionId": "",

  "type": "NamedExport" | "NamedImport",
  "name": "Button",
  "meta": {
    "location": {
        "file": "",
        "line": "",
        "column": "",
    },
  }
}
```

- Edge
```json
{
  "from": "",
  "to": "",

  "meta": {
  }
}
```


### Static Analysis
The static-analysis should do the following things:
1. Get Nodes and Edges that belong to the project.
2. Detect dependecy changes for given changes


### Validation
Validation should run parallel, and block the CI pipeline if there is any error.

- delete Node that is used by other modules(error)
- import a Node that is not in the dependency graph(error)
- read/write on the same Storage(local storage, session storage, global variables)(warning)
- code changes that on the dependency path should be detected
    - e.g. a line of code that in the function A, A is on a call graph path that is a Node
    - React Component changed that is on a render tree path which is a dependency node that used by other modules
- a cyclic dependency path is detected

### Reporting


## Example scenarios

### 1. /xxx/remoteEntry.js 404

### 2. 组件库x.x中找不到xxx组件

### 3. Module './xxx' does not exist in the container

### 4. xxx is not a function

## Hatch
When code that do need to break the dependency, esplecially large refactorying involves, we need to bypass the validation.

## The Dependecy Manager Server
We need a server to store the dependencies and provide the API for the dependencies management.

### The database
SQlite, by only store project-level dependencies in the central database, this simpltfy the query for dependecy-graph in a relation database.
And it also supports raw json column for the metadata property.

### The API

<!-- - get the depdency nodes
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

- get the dependency graph by project key
/GET /dependencies/:project -->

- create a DMS pipeline
/POST /dms/actions
/GET /dms/actions/:id
/DELETE /dms/actions/:id

- get action result
/GET /dms/actions/:id/result


### The framework
Fastify, performant, easy to use, good DX

## Static Analysis

- Get the Static ES6 Modules Import/Export(CodeQL scripts)
- Get the MF webpack configuration(node)
- Get the runtime dynamic import(CodeQL scripts)
- Get the externals(CodeQL scripts)
- Get the global state(CodeQL scripts)
- Get the events(CodeQL scripts)
- Get the dynamic module federation reference(CodeQL scripts)

## Gitlab Integration


## Validation

- Delete Node that is used by other modules(error)