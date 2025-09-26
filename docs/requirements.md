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
4. Events
5. Runtime MF reference

### 3. The unknown dependencies
1. SideEffects
some packages may has side effects, like console.log


## Example scenarios

### 1. /xxx/remoteEntry.js 404

### 2. 组件库x.x中找不到xxx组件

### 3. Module './xxx' does not exist in the container

### 4. xxx is not a function

## Hatch

When code that do need to break the dependency, esplecially large refactorying involves, we need to bypass the validation.

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
