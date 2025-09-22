## Introduction
The CLI is a command-line interface for the static analysis, its goal is to generate a dependecies data for the given repository.

## Core Functions

### Get the static ES6Module Imports and Exports

For any give project, it should relys on some dependencies through the npm modules, this dependencies normally can be found in the package.json file,
but its not enough, the **static analysis** should obtain the Imports from the source code, check the "import" statment and "import()" expression line by line
to get a reliable dependencies data.
For ES6Module Exports, this is different for different project, if the project is an application(web pages), its Exports only exists in the MF exports files; 
For libs, its Exports should be declared in its entry file, like index.ts, index.tsx etc. the entry files for libs can be configed by the file like sy.config.json

### MF webpack config

### Get the runtime dynamic import
We have a runtime function called dynamicImport(imported from '@xxx/global'), this function is used to import a module dynamically at runtime, this also create a depedency between the application and the
imported module.

Example:
this create a dependency between the application and the imported module(@xxx/module) named export 'xxx'.
```ts
import { dynamicImport } from '@xxx/global'
const module = await dynamicImport('@xxx/module')
// use
module.xxx()
```

### Get the externals
The externals is a global variable that is defined by outside the project, like window.xxx
Example:
This create a dependency between the application and the global variable 'xxx'.
```ts
const xxx = window.xxx
// use
xxx.yyy()
```

### Get the global state

### Events

### Runtime MF reference


## Commands
It only provides one command to run the static analysis

```bash
clis analyze --project=<git http url> --branch=<branch name>
```
At its internal, it will do the following steps:
1. Checkout the repository
2. Initialize the codeQL execution environment
3. Create the codeQL database
4. Run the Queries
5. Interprete the query results
6. Upload the result to the server

## The Checkout
The checkout is a function to checkout the repository from the gitlab, it will use the gitlab api to get the repository, and then checkout the repository to the local.

## The codeQL adapter
The adapter should be a programmatic API for the codeQL cli client, so that we can use it to analyze the code.

### CodeQL Queries
This is the core part about the static analysis, it will use the codeQL queries to analyze the code, and then generate the result.
It may need to accept some parameters to fullfill the query, like the we'd like to query call-graph of a given Function AST location.

## Result processing
Before we can upload the result to the server, we need to process the result, because at the server side we only store Nodes and Connections, we may also need to fetch the Nodes or Connections from other Projects.


## Tech stack
Requirements:
- NodeJS v22
- Typescript
- Yargs