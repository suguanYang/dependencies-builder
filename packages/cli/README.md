## Introduction
The CLI is a command-line interface for the static analysis, its goal is to generate a dependecies data for the given repository.

## Core Functions

### Get the static ES6Module Imports and Exports

For any give project, it should relys on some dependencies through the npm modules, this dependencies normally can be found in the package.json file,
but its not enough, the **static analysis** should obtain the Imports from the source code, check the "import" statment and "import()" expression line by line
to get a reliable dependencies data.
For ES6Module Exports, this is different for different project, if the project is an application(web pages), its Exports only exists in the MF exports files; 
For libs, its Exports should be declared in its entry file, like index.ts, index.tsx etc. the entry files for libs can be configed by the file like sy.config.json

### Get the MF webpack configuration
For the applications, it usually can config a custom webpack configuration file, which can config the MF webpack configuration.

### Get the runtime dynamic import
We have a runtime function called dynamicImport, this function is used to import a module dynamically at runtime, this also create a depedency between the application and the
imported module.

## Commands
It only provides one command to run the static analysis, at its internal, it will do the following steps:

1. Checkout the repository
2. Initialize the codeQL execution environment
3. Create the codeQL database
4. Run the Queries
5. Interprete the query results
6. Upload the result to the server


## The codeQL adapter
The adapter should be a programmatic API for the codeQL cli client, so that we can use it to analyze the code.


## Tech stack

Requirements:
- NodeJS v22
- Typescript
- Vitest