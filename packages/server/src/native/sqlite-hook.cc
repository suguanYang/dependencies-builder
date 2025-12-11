#include <node_api.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <vector>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <iostream>
#include <sstream>
#include <algorithm>
#include <set>
#include <map>
#include <stack>
#include <string_view>
#include "sqlite3ext.h"
#include <stdarg.h>


#ifdef _WIN32
  #define DLLEXPORT __declspec(dllexport)
#else
  #define DLLEXPORT __attribute__((visibility("default")))
#endif

SQLITE_EXTENSION_INIT1

// --- Existing N-API Hook Logic ---

// napi_threadsafe_function tsfn = NULL;

// void UpdateHook(void* user_data, int operation, const char* database, const char* table, sqlite3_int64 rowid) {
//     if (table && strcmp(table, "Node") == 0) {
//         if (tsfn != NULL) {
//             napi_call_threadsafe_function(tsfn, NULL, napi_tsfn_nonblocking);
//         }
//     }
// }

// napi_value Setup(napi_env env, napi_callback_info info) {
//     size_t argc = 1;
//     napi_value args[1];
//     napi_value this_arg;
//     void* data;

//     napi_status status = napi_get_cb_info(env, info, &argc, args, &this_arg, &data);
//     if (status != napi_ok) return NULL;

//     if (argc < 1) {
//         napi_throw_type_error(env, NULL, "Function expected");
//         return NULL;
//     }

//     napi_value resource_name;
//     napi_create_string_utf8(env, "SQLiteUpdateHook", NAPI_AUTO_LENGTH, &resource_name);

//     status = napi_create_threadsafe_function(
//         env,
//         args[0],
//         NULL,
//         resource_name,
//         0,
//         1,
//         NULL,
//         NULL,
//         NULL,
//         NULL,
//         &tsfn
//     );

//     if (status != napi_ok) {
//         napi_throw_error(env, NULL, "Failed to create threadsafe function");
//         return NULL;
//     }

//     napi_unref_threadsafe_function(env, tsfn);

//     return NULL;
// }

// --- Graph Algorithms & Structures ---

struct GraphNode {
    std::string id;
    std::string name;
    std::string type;
    std::string projectName;
    std::string projectId; // Added for project graph
    std::string branch;
    std::string relativePath;
    int startLine = 0;
    int startColumn = 0;
    std::string addr; // for project
};

struct GraphConnection {
    std::string id;
    std::string fromId;
    std::string toId;
};

// Orthogonal Graph Structures (Indices)
struct OGVertex {
    GraphNode data;
    int firstIn = -1;
    int firstOut = -1;
    int inDegree = 0;
    int outDegree = 0;
};

struct OGEdge {
    GraphConnection data;
    int tailvertex = -1;
    int headvertex = -1;
    int headnext = -1;
    int tailnext = -1;
};

struct OrthogonalGraph {
    std::vector<OGVertex> vertices;
    std::vector<OGEdge> edges;
};

// --- JSON Builder ---

class JsonBuilder {
    std::string json;
public:
    JsonBuilder() { json.reserve(4 * 1024 * 1024); } // 4MB
    
    void beginObject() { json += "{"; }
    void endObject() { json += "}"; }
    void beginArray() { json += "["; }
    void endArray() { json += "]"; }
    void key(std::string_view k) { 
        json += "\""; json += k; json += "\":"; 
    }
    void string(std::string_view s) {
        json += "\"";
        size_t lastPos = 0;
        size_t pos = s.find_first_of("\"\\/\b\f\n\r\t", lastPos);
        
        if (pos == std::string_view::npos) {
            json += s;
        } else {
            while (pos != std::string_view::npos) {
                json.append(s.data() + lastPos, pos - lastPos);
                switch(s[pos]) {
                    case '"': json += "\\\""; break;
                    case '\\': json += "\\\\"; break;
                    case '\b': json += "\\b"; break;
                    case '\f': json += "\\f"; break;
                    case '\n': json += "\\n"; break;
                    case '\r': json += "\\r"; break;
                    case '\t': json += "\\t"; break;
                    default: json += s[pos]; break; 
                }
                lastPos = pos + 1;
                pos = s.find_first_of("\"\\/\b\f\n\r\t", lastPos);
            }
            json.append(s.data() + lastPos, s.length() - lastPos);
        }
        json += "\"";
    }
    void number(int n) { json += std::to_string(n); }
    void comma() { json += ","; }
    
    std::string str() { return json; }
};

// --- Logic ---

OrthogonalGraph BuildOrthogonalGraph(const std::vector<GraphNode>& nodes, const std::vector<GraphConnection>& connections) {
    OrthogonalGraph graph;
    graph.vertices.reserve(nodes.size());
    graph.edges.reserve(connections.size());
    
    std::unordered_map<std::string, int> nodeIndexMap;
    
    // 1. Create Vertices
    for (size_t i = 0; i < nodes.size(); ++i) {
        nodeIndexMap[nodes[i].id] = (int)i;
        OGVertex v;
        v.data = nodes[i];
        graph.vertices.push_back(v);
    }
    
    // 2. Create Edges
    for (const auto& conn : connections) {
        auto itFrom = nodeIndexMap.find(conn.fromId);
        auto itTo = nodeIndexMap.find(conn.toId);
        
        if (itFrom == nodeIndexMap.end() || itTo == nodeIndexMap.end()) continue;
        
        int fromIndex = itFrom->second;
        int toIndex = itTo->second;
        
        int edgeIndex = (int)graph.edges.size();
        
        // Update Target (Incoming)
        int currentFirstIn = graph.vertices[toIndex].firstIn;
        graph.vertices[toIndex].firstIn = edgeIndex;
        graph.vertices[toIndex].inDegree++;
        
        // Update Source (Outgoing)
        int currentFirstOut = graph.vertices[fromIndex].firstOut;
        graph.vertices[fromIndex].firstOut = edgeIndex;
        graph.vertices[fromIndex].outDegree++;
        
        OGEdge edge;
        edge.data = conn;
        edge.tailvertex = fromIndex;
        edge.headvertex = toIndex;
        edge.headnext = currentFirstIn;
        edge.tailnext = currentFirstOut;
        
        graph.edges.push_back(edge);
    }
    
    return graph;
}

// DFS Cycle Detection
// 0: White, 1: Gray, 2: Black
// Iterative DFS Cycle Detection to prevent stack overflow
void dfs_cycle_iterative(int startNode, const OrthogonalGraph& graph, std::vector<uint8_t>& visited, std::vector<std::vector<GraphNode>>& cycles) {
    struct Frame {
        int u;
        int edgeIndex;
    };
    
    std::vector<int> pathStack;      // Tracks nodes in current traversal path
    std::vector<uint8_t> onStack(graph.vertices.size(), 0); // O(1) lookup if node is in current path
    std::vector<Frame> callStack;    // simulates recursion

    callStack.push_back({startNode, graph.vertices[startNode].firstOut});
    visited[startNode] = 1; // Gray
    onStack[startNode] = 1;
    pathStack.push_back(startNode);

    while (!callStack.empty()) {
        Frame& frame = callStack.back();

        if (frame.edgeIndex == -1) {
            // Post-visit (Black)
            onStack[frame.u] = 0;
            visited[frame.u] = 2; // Black
            pathStack.pop_back();
            callStack.pop_back();
            continue;
        }

        const OGEdge& edge = graph.edges[frame.edgeIndex];
        int v = edge.headvertex;
        
        // Advance current frame's edge index for when we return
        frame.edgeIndex = edge.tailnext;

        if (visited[v] == 1 && onStack[v]) {
            // Cycle Detected
            std::vector<GraphNode> cycle;
            bool record = false;
            for (int nodeIdx : pathStack) {
                if (nodeIdx == v) record = true;
                if (record) {
                    cycle.push_back(graph.vertices[nodeIdx].data); // copy
                }
            }
            cycle.push_back(graph.vertices[v].data);
            cycles.push_back(std::move(cycle));
        } 
        else if (visited[v] == 0) {
            // Recurse
            visited[v] = 1; // Gray
            onStack[v] = 1;
            pathStack.push_back(v);
            callStack.push_back({v, graph.vertices[v].firstOut});
        }
    }
}

std::vector<std::vector<GraphNode>> DetectCycles(const OrthogonalGraph& graph) {
    std::vector<std::vector<GraphNode>> cycles;
    std::vector<uint8_t> visited(graph.vertices.size(), 0);
    std::vector<int> stack;
    
    for (size_t i = 0; i < graph.vertices.size(); ++i) {
        if (visited[i] == 0) {
            dfs_cycle_iterative((int)i, graph, visited, cycles);
        }
    }
    return cycles;
}

std::string SerializeGraph(const OrthogonalGraph& graph, const std::vector<std::vector<GraphNode>>& cycles) {
    JsonBuilder jb;
    jb.beginObject();
    
    // Vertices
    jb.key("vertices");
    jb.beginArray();
    for (size_t i = 0; i < graph.vertices.size(); ++i) {
        if (i > 0) jb.comma();
        const auto& v = graph.vertices[i];
        jb.beginObject();
            jb.key("data");
            jb.beginObject();
                jb.key("id"); jb.string(v.data.id); jb.comma();
                jb.key("name"); jb.string(v.data.name); jb.comma();
                jb.key("type"); jb.string(v.data.type); jb.comma();
                
                if (!v.data.projectName.empty()) {
                   jb.key("projectName"); jb.string(v.data.projectName); jb.comma();
                }
                if (!v.data.projectId.empty()) {
                   jb.key("projectId"); jb.string(v.data.projectId); jb.comma();
                }
                
                jb.key("branch"); jb.string(v.data.branch); jb.comma();
                
                if (!v.data.relativePath.empty()) {
                    jb.key("relativePath"); jb.string(v.data.relativePath); jb.comma();
                    jb.key("startLine"); jb.number(v.data.startLine); jb.comma();
                    jb.key("startColumn"); jb.number(v.data.startColumn);
                } else if (!v.data.addr.empty()) {
                    jb.key("addr"); jb.string(v.data.addr);
                } else {
                    jb.key("_"); jb.number(0); // Dummy
                }
            jb.endObject();
            jb.comma();
            
            jb.key("firstIn"); jb.number(v.firstIn); jb.comma();
            jb.key("firstOut"); jb.number(v.firstOut); jb.comma();
            jb.key("inDegree"); jb.number(v.inDegree); jb.comma();
            jb.key("outDegree"); jb.number(v.outDegree);
        jb.endObject();
    }
    jb.endArray();
    jb.comma();
    
    // Edges
    jb.key("edges");
    jb.beginArray();
    for (size_t i = 0; i < graph.edges.size(); ++i) {
        if (i > 0) jb.comma();
        const auto& e = graph.edges[i];
        jb.beginObject();
            jb.key("data");
            jb.beginObject();
                jb.key("id"); jb.string(e.data.id); jb.comma();
                jb.key("fromId"); jb.string(e.data.fromId); jb.comma();
                jb.key("toId"); jb.string(e.data.toId);
            jb.endObject();
            jb.comma();
            
            jb.key("tailvertex"); jb.number(e.tailvertex); jb.comma();
            jb.key("headvertex"); jb.number(e.headvertex); jb.comma();
            jb.key("headnext"); jb.number(e.headnext); jb.comma();
            jb.key("tailnext"); jb.number(e.tailnext);
        jb.endObject();
    }
    jb.endArray();

    // Cycles
    if (!cycles.empty()) {
        jb.comma();
        jb.key("cycles");
        jb.beginArray();
        for (size_t i = 0; i < cycles.size(); ++i) {
            if (i > 0) jb.comma();
            jb.beginArray();
            for (size_t j = 0; j < cycles[i].size(); ++j) {
                if (j > 0) jb.comma();
                jb.beginObject();
                    jb.key("id"); jb.string(cycles[i][j].id); jb.comma();
                    jb.key("name"); jb.string(cycles[i][j].name); jb.comma();
                    jb.key("type"); jb.string(cycles[i][j].type);
                jb.endObject();
            }
            jb.endArray();
        }
        jb.endArray();
    }

    jb.endObject();
    return jb.str();
}

// --- New AutoCreateConnections Logic ---

// AutoCreateConnections Removed - Logic moved to Node.js/Prisma



// helper to quote string for SQL
std::string sql_quote(const std::string& s) {
    std::string res = "'";
    for (char c : s) {
        if (c == '\'') res += "''";
        else res += c;
    }
    res += "'";
    return res;
}

// Get Node Dependency Graph
// Get Node Dependency Graph REWRITTEN with Recursive CTE
// Get Node Dependency Graph REWRITTEN with Temp Table + Recursive CTE
static void GetNodeDependencyGraph(sqlite3_context *context, int argc, sqlite3_value **argv) {
    if (argc < 1) return;
    std::string startNodeId((const char*)sqlite3_value_text(argv[0]));
    int maxDepth = (argc >= 2) ? sqlite3_value_int(argv[1]) : 100;
    
    sqlite3 *db = sqlite3_context_db_handle(context);

    // 1. Create a Temp table
    sqlite3_exec(db, "CREATE TEMPORARY TABLE IF NOT EXISTS TempGraphNodes (id TEXT PRIMARY KEY, depth INT)", NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM TempGraphNodes", NULL, NULL, NULL);

    // 2. Run CTE and insert
    std::string cteSql = R"(
        WITH RECURSIVE traverse(id, depth) AS (
            SELECT id, 0 FROM Node WHERE id = ?
            UNION
            SELECT CASE WHEN C.fromId = t.id THEN C.toId ELSE C.fromId END, t.depth + 1
            FROM traverse t
            JOIN Connection C ON (C.fromId = t.id OR C.toId = t.id)
            WHERE t.depth < ?
        )
        INSERT OR IGNORE INTO TempGraphNodes SELECT id, depth FROM traverse;
    )";

    sqlite3_stmt* stmt;
    if (sqlite3_prepare_v2(db, cteSql.c_str(), -1, &stmt, NULL) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, startNodeId.c_str(), -1, SQLITE_STATIC);
        sqlite3_bind_int(stmt, 2, maxDepth);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }

    // 3. Fetch Nodes via Join
    std::vector<GraphNode> nodes;
    if (sqlite3_prepare_v2(db, 
        "SELECT n.id, n.name, n.type, n.projectName, n.branch, n.relativePath, n.startLine, n.startColumn "
        "FROM Node n JOIN TempGraphNodes t ON n.id = t.id", 
        -1, &stmt, NULL) == SQLITE_OK) {
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            GraphNode n;
            n.id = (const char*)sqlite3_column_text(stmt, 0);
            n.name = (const char*)sqlite3_column_text(stmt, 1);
            n.type = (const char*)sqlite3_column_text(stmt, 2);
            n.projectName = (const char*)sqlite3_column_text(stmt, 3);
            n.branch = (const char*)sqlite3_column_text(stmt, 4);
            const char* rp = (const char*)sqlite3_column_text(stmt, 5);
            n.relativePath = rp ? rp : "";
            n.startLine = sqlite3_column_int(stmt, 6);
            n.startColumn = sqlite3_column_int(stmt, 7);
            nodes.push_back(std::move(n));
        }
        sqlite3_finalize(stmt);
    }

    // 4. Fetch Connections via Join with Temp Table
    std::vector<GraphConnection> connections;
    if (sqlite3_prepare_v2(db, 
        "SELECT fromId, toId FROM Connection "
        "WHERE fromId IN (SELECT id FROM TempGraphNodes) AND toId IN (SELECT id FROM TempGraphNodes)", 
        -1, &stmt, NULL) == SQLITE_OK) {
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            GraphConnection c;
            c.fromId = (const char*)sqlite3_column_text(stmt, 0);
            c.toId = (const char*)sqlite3_column_text(stmt, 1);
            c.id = c.fromId + "-" + c.toId;
            connections.push_back(std::move(c));
        }
        sqlite3_finalize(stmt);
    }

    OrthogonalGraph og = BuildOrthogonalGraph(nodes, connections);
    // Cycle detection optional, off by default for massive speed
    std::vector<std::vector<GraphNode>> cycles; 
    std::string json = SerializeGraph(og, cycles);
    sqlite3_result_text(context, json.c_str(), -1, SQLITE_TRANSIENT);
}

// Helper struct for result
struct ProjectGraphResult {
    OrthogonalGraph graph;
    std::vector<std::vector<GraphNode>> cycles;
};

static ProjectGraphResult BuildProjectGraphImpl(sqlite3* db, std::string startProjectId, std::string branch, int maxDepth) {
     // 1. Create Temp Table
     sqlite3_exec(db, "CREATE TEMPORARY TABLE IF NOT EXISTS TempGraphProjects (id TEXT PRIMARY KEY, depth INT)", NULL, NULL, NULL);
     sqlite3_exec(db, "DELETE FROM TempGraphProjects", NULL, NULL, NULL);

     // 2. Recursive CTE
     std::string sql = R"(
        WITH RECURSIVE proj_traverse(projectId, depth) AS (
            -- Start
            SELECT id, 0 FROM Project WHERE id = ?
            UNION
            -- Recurse
            SELECT DISTINCT 
                CASE WHEN N1.projectId = pt.projectId THEN N2.projectId ELSE N1.projectId END,
                pt.depth + 1
            FROM proj_traverse pt
            JOIN Node N1 ON N1.projectId = pt.projectId
            JOIN Connection C ON (C.fromId = N1.id OR C.toId = N1.id)
            JOIN Node N2 ON (C.fromId = N2.id OR C.toId = N2.id)
            WHERE pt.depth < ?
              AND N1.branch = ? 
              AND N2.branch = ?
              AND N1.projectId != N2.projectId
        )
        INSERT OR IGNORE INTO TempGraphProjects SELECT projectId, depth FROM proj_traverse;
    )";
    
    sqlite3_stmt* stmt;
    if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, NULL) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, startProjectId.c_str(), -1, SQLITE_STATIC);
        sqlite3_bind_int(stmt, 2, maxDepth);
        sqlite3_bind_text(stmt, 3, branch.c_str(), -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 4, branch.c_str(), -1, SQLITE_STATIC);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }

    // 3. Fetch Vertices
    std::vector<GraphNode> nodesList;
    std::string vSql = "SELECT p.id, p.name, p.addr, p.type FROM Project p JOIN TempGraphProjects t ON p.id = t.id";
    if (sqlite3_prepare_v2(db, vSql.c_str(), -1, &stmt, NULL) == SQLITE_OK) {
        while (sqlite3_step(stmt) == SQLITE_ROW) {
             GraphNode p;
             p.id = (const char*)sqlite3_column_text(stmt, 0);
             p.name = (const char*)sqlite3_column_text(stmt, 1);
             p.addr = (const char*)sqlite3_column_text(stmt, 2);
             p.type = (const char*)sqlite3_column_text(stmt, 3);
             p.branch = branch;
             nodesList.push_back(std::move(p));
        }
         sqlite3_finalize(stmt);
    }
    
    // 4. Fetch Edges
    // Using TempTable
    std::vector<GraphConnection> connList;
    std::string eSql = R"(
        SELECT DISTINCT N1.projectId, N2.projectId 
        FROM Connection C 
        JOIN Node N1 ON C.fromId = N1.id 
        JOIN Node N2 ON C.toId = N2.id 
        JOIN TempGraphProjects T1 ON N1.projectId = T1.id 
        JOIN TempGraphProjects T2 ON N2.projectId = T2.id
        WHERE N1.branch = ? AND N2.branch = ? 
          AND N1.projectId != N2.projectId
    )";
    
    if (sqlite3_prepare_v2(db, eSql.c_str(), -1, &stmt, NULL) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, branch.c_str(), -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 2, branch.c_str(), -1, SQLITE_STATIC);
        
        while (sqlite3_step(stmt) == SQLITE_ROW) {
             GraphConnection gc;
             gc.fromId = (const char*)sqlite3_column_text(stmt, 0);
             gc.toId = (const char*)sqlite3_column_text(stmt, 1);
             gc.id = gc.fromId + "-" + gc.toId;
             connList.push_back(std::move(gc));
        }
        sqlite3_finalize(stmt);
    }
    
    OrthogonalGraph og = BuildOrthogonalGraph(nodesList, connList);
    auto cycles = DetectCycles(og);
    
    return { og, cycles };
}

// Get Project Dependency Graph
static void GetProjectDependencyGraph(sqlite3_context *context, int argc, sqlite3_value **argv) {
    if (argc < 2) {
        sqlite3_result_error(context, "Requires projectId, branch", -1);
        return;
    }

    std::string startProjectId((const char*)sqlite3_value_text(argv[0]));
    std::string branch((const char*)sqlite3_value_text(argv[1]));
    int maxDepth = 100;
    if (argc >= 3) maxDepth = sqlite3_value_int(argv[2]);

    sqlite3 *db = sqlite3_context_db_handle(context);
    
    if (startProjectId == "*") {
        // Multi-graph mode
        std::vector<std::string> allProjects;
        sqlite3_stmt* stmt;
        if (sqlite3_prepare_v2(db, "SELECT id FROM Project", -1, &stmt, NULL) == SQLITE_OK) {
            while (sqlite3_step(stmt) == SQLITE_ROW) {
                allProjects.push_back((const char*)sqlite3_column_text(stmt, 0));
            }
            sqlite3_finalize(stmt);
        }
        
        std::unordered_set<std::string> remainingProjects(allProjects.begin(), allProjects.end());
        std::vector<std::string> graphJsons;
        
        // Just iterate through the original list to maintain a stable order
        for (const auto& pid : allProjects) {
            // Check if still in remaining (not yet covered by another graph)
            if (remainingProjects.find(pid) == remainingProjects.end()) {
                continue;
            }
            
            // Build graph with unlimited depth for this project
            // Using a large number for unlimited depth
            ProjectGraphResult res = BuildProjectGraphImpl(db, pid, branch, 100000);
            
            // Remove contained projects from remaining
            for (const auto& node : res.graph.vertices) {
                remainingProjects.erase(node.data.id);
            }
            
            // Serialize
            graphJsons.push_back(SerializeGraph(res.graph, res.cycles));
        }
        
        // Construct JSON Array
        std::string json = "[";
        for (size_t i = 0; i < graphJsons.size(); ++i) {
            if (i > 0) json += ",";
            json += graphJsons[i];
        }
        json += "]";
        
        sqlite3_result_text(context, json.c_str(), -1, SQLITE_TRANSIENT);
        
    } else {
        // Single project mode
        ProjectGraphResult res = BuildProjectGraphImpl(db, startProjectId, branch, maxDepth);
        std::string json = SerializeGraph(res.graph, res.cycles);
        sqlite3_result_text(context, json.c_str(), -1, SQLITE_TRANSIENT);
    }
}


#ifdef __cplusplus
extern "C" {
#endif
    DLLEXPORT int sqlite3_extension_init(
        sqlite3 *db, 
        char **pzErrMsg, 
        const sqlite3_api_routines *pApi
    ) {
        SQLITE_EXTENSION_INIT2(pApi);
        sqlite3_create_function(db, "auto_create_connections", 0, SQLITE_UTF8, NULL, NULL, NULL, NULL); // Removed
        
        // New Functions
        sqlite3_create_function(db, "get_node_dependency_graph", 1, SQLITE_UTF8, NULL, GetNodeDependencyGraph, NULL, NULL);
        sqlite3_create_function(db, "get_node_dependency_graph", 2, SQLITE_UTF8, NULL, GetNodeDependencyGraph, NULL, NULL); // Optional depth
        
        sqlite3_create_function(db, "get_project_dependency_graph", 2, SQLITE_UTF8, NULL, GetProjectDependencyGraph, NULL, NULL);
        sqlite3_create_function(db, "get_project_dependency_graph", 3, SQLITE_UTF8, NULL, GetProjectDependencyGraph, NULL, NULL);

        return SQLITE_OK;
    }
#ifdef __cplusplus
}
#endif

// NAPI 
// napi_value Init(napi_env env, napi_value exports) {
//     napi_value setup_fn;
//     napi_create_function(env, "setup", NAPI_AUTO_LENGTH, Setup, NULL, &setup_fn);
//     napi_set_named_property(env, exports, "setup", setup_fn);
//     return exports;
// }

// NAPI_MODULE(sqlite_hook, Init)
