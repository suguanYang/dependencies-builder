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
- Fastify-based API server
- SQLite database with Prisma ORM
- RESTful APIs for nodes, connections, actions, and projects
- Real-time action execution and streaming

### 2. CLI (`packages/cli`)
- CodeQL-based static analysis
- Project dependency extraction
- Batch upload to server
- Support for monorepos and standalone projects

### 3. Web (`packages/web`)
- Next.js frontend application
- Real-time visualization of dependencies
- Project management interface
- Action monitoring and reporting

## New Projects Model

### Overview

The new Projects model provides centralized project management with the following benefits:

- **Centralized Project Information**: Store project metadata and configuration
- **Entries Path Storage**: For projects that cannot determine entries via static analysis
- **Better Data Organization**: Proper relational structure between projects and nodes
- **Improved Query Performance**: Indexed project names and relationships

### Database Schema

#### Projects Model
```prisma
model Project {
  id        String   @id @default(cuid())
  name      String   @unique
  entries   Json?    // Project entries path for static analysis
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  nodes Node[]
}
```

#### Updated Nodes Model
```prisma
model Node {
  id           String   @id @default(cuid())
  projectId    String   // Foreign key to Project
  projectName  String   // Denormalized for easy querying
  name         String
  type         NodeType
  branch       String
  version      String?
  relativePath String?
  startLine    Int?
  startColumn  Int?
  endLine      Int?
  endColumn    Int?
  meta         Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

### API Endpoints

#### Projects CRUD APIs

- `GET /projects` - List all projects with pagination
- `GET /projects/:id` - Get project by ID
- `GET /projects/name/:name` - Get project by name
- `POST /projects` - Create new project
- `PUT /projects/:id` - Update project
- `DELETE /projects/:id` - Delete project

#### Updated Nodes APIs

All nodes APIs now support filtering by `projectName` instead of `project`:

- `GET /nodes?projectName=:name` - Filter nodes by project name
- `POST /nodes` - Create node with `projectName` field
- `PUT /nodes/:id` - Update node with `projectName` field

### Usage

#### Creating Projects

Projects can be created manually via the API or automatically by the CLI during upload:

```bash
# Create project via API
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-project",
    "entries": {
      "main": "./src/index.js",
      "module": "./src/module.js"
    }
  }'
```

#### CLI Integration

The CLI automatically handles project creation and management:

```bash
# Analyze and upload project dependencies
npm run analyze -- --project my-project --branch main

# The CLI will:
# 1. Check if project exists
# 2. Create project if needed
# 3. Upload nodes with proper projectId and projectName
```

#### Web Interface

The web interface provides:

- **Projects Management**: View, create, edit, and delete projects
- **Project Filtering**: Filter nodes by project name
- **Project-based Actions**: Run actions specific to projects
- **Cross-project Analysis**: Analyze dependencies across multiple projects

### Benefits

1. **Data Integrity**: Proper foreign key relationships prevent orphaned nodes
2. **Performance**: Denormalized `projectName` field enables fast filtering
3. **Flexibility**: `entries` field supports projects with complex entry point configurations
4. **Scalability**: Supports large-scale multi-project dependency analysis

## Development

### Prerequisites

- Node.js 18+
- pnpm
- SQLite

### Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up database:
   ```bash
   cd packages/server
   pnpm prisma generate
   pnpm prisma db push
   ```

3. Start development servers:
   ```bash
   # Terminal 1 - Server
   cd packages/server
   pnpm dev

   # Terminal 2 - Web
   cd packages/web
   pnpm dev
   ```

### Testing

Run tests for all packages:

```bash
# Server tests
cd packages/server
pnpm test

# Web tests
cd packages/web
pnpm test

# CLI tests
cd packages/cli
pnpm test
```

## Deployment

### Production Build

```bash
# Build all packages
pnpm build

# Start production server
cd packages/server
pnpm start
```

### Environment Variables

#### Server
- `DATABASE_URL`: SQLite database path
- `PORT`: Server port (default: 3001)

#### Web
- `NEXT_PUBLIC_API_URL`: Server API URL

#### CLI
- `DMS_SERVER_URL`: Server URL for uploads

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the code style guidelines
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License