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
- `DATABASE_URL`: SQLite database path
- `PORT`: Server port (default: 3001)

#### Web
- `NEXT_PUBLIC_API_URL`: Server API URL

#### CLI
- `DMS_SERVER_URL`: Server URL for uploads


## Setup