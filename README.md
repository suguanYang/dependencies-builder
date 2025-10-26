# Dependency Management System (DMS)

A comprehensive system for managing and analyzing project dependencies across multiple repositories and branches.

## Overview

The Dependency Management System (DMS) provides:
- **Static analysis** of code dependencies using CodeQL
- **Visualization** of dependency graphs
- **Impact analysis** for code changes
- **Cross-project dependency tracking**

## Architecture

DMS consists of three main packages:

### 1. Server (`packages/server`)

### 2. CLI (`packages/cli`)

### 3. Web (`packages/web`)


### Environment Variables

#### Server
- `DATABASE_URL`:     SQLite database path
- `PORT`:             Server port (default: 3001)
- `PATH`:             Setup codeql in the PATH is may needed, but we also need to ensure to preserve the docker image's default path var
- `PORT`:             Server port (default: 3001)
- `GIT_TOKEN_NAME`:   Repository git token name
- `GIT_TOKEN_VALUE`:  ---- token value
- `DMS_LOCAL_DIR`:    Cli local space, used to store results(call graph especially)
- `DMS_LOGS_DIR`:     Log dir
- `CLIENT_DOMAIN`:    The web client addr
- `ADMIN_USER_EMAIL`: The default apikey user

#### Web
- `NEXT_PUBLIC_API_URL`: Server API URL

## Setup

1. Install Dependencies

Run `pnpm install` at project root directory

2. Setup development env

- Create a .env file at @packages/server with correspoding env vars
- Run `pnpm db:generate` and `pnpm db:deploy`

3. Build the cli
Run `pnpm build` at @packages/cli

4. Run the web and server

## Production

### Debugging

1. setup debugger

```
kill -USR1 <pid>
```

2. attach to process
```
node inspect -p <pid>
```

More: https://nodejs.org/api/debugger.html