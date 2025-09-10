-- Node table schema
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    branch TEXT NOT NULL,
    project TEXT NOT NULL,
    version TEXT,
    type INTEGER NOT NULL,
    name TEXT NOT NULL,
    relativePath TEXT,
    startLine INTEGER,
    startColumn INTEGER,
    meta TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Edge table schema
CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    fromId TEXT NOT NULL,
    toId TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fromId) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (toId) REFERENCES nodes(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nodes_branch_project_type_name ON nodes(branch, project, type, name);
CREATE INDEX IF NOT EXISTS idx_nodes_project_branch ON nodes(project, branch);
CREATE INDEX IF NOT EXISTS idx_nodes_type_name ON nodes(type, name);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(fromId);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(toId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_from_to ON edges(fromId, toId);