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
#include <set>
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
        graph.vertices.push_back(std::move(v));
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
        
        graph.edges.push_back(std::move(edge));
    }
    
    return graph;
}

// Simple DFS-based cycle detection that finds all elementary cycles
// Much faster than Johnson's algorithm - explores from each vertex independently

void find_cycles_from_vertex(int start, const OrthogonalGraph& graph, std::vector<std::vector<GraphNode>>& cycles) {
    std::vector<bool> visited(graph.vertices.size(), false);
    std::vector<bool> on_stack(graph.vertices.size(), false);
    std::vector<int> path;
    
    struct StackFrame {
        int node;
        int edge_idx;
        bool first_visit;
    };
    
    std::vector<StackFrame> stack;
    stack.push_back({start, graph.vertices[start].firstOut, true});
    
    while (!stack.empty()) {
        StackFrame& frame = stack.back();
        
        if (frame.first_visit) {
            // First visit to this node
            visited[frame.node] = true;
            on_stack[frame.node] = true;
            path.push_back(frame.node);
            frame.first_visit = false;
        }
        
        if (frame.edge_idx == -1) {
            // No more edges, backtrack
            on_stack[frame.node] = false;
            path.pop_back();
            stack.pop_back();
            continue;
        }
        
        const OGEdge& edge = graph.edges[frame.edge_idx];
        int next = edge.headvertex;
        frame.edge_idx = edge.tailnext; // Advance for next iteration
        
        if (next == start && path.size() > 1) {
            // Found cycle back to start
            std::vector<GraphNode> cycle;
            for (int idx : path) {
                cycle.push_back(graph.vertices[idx].data);
            }
            cycle.push_back(graph.vertices[start].data);
            cycles.push_back(cycle);
        } else if (!visited[next]) {
            // Explore this path
            stack.push_back({next, graph.vertices[next].firstOut, true});
        }
    }
}

std::vector<std::vector<GraphNode>> DetectCycles(const OrthogonalGraph& graph) {
    std::vector<std::vector<GraphNode>> cycles;
    
    // Find cycles by starting DFS from each vertex
    // Each vertex can be the "root" of cycles that return to it
    for (size_t i = 0; i < graph.vertices.size(); ++i) {
        find_cycles_from_vertex(i, graph, cycles);
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


struct Node {
    std::string id;
    std::string type;
    std::string name;
    std::string projectName;
    std::string branch;
    std::string meta; // format: {"entryName":"..."}
};

// Helper: Simple JSON string extraction for "entryName"
// Extremely naive, assumes standard formatting but fast.
std::string_view getEntryName(std::string_view meta) {
    std::string_view key = "\"entryName\"";
    size_t pos = meta.find(key);
    if (pos == std::string_view::npos) return "";
    
    pos += key.length();
    // skip until first quote
    pos = meta.find('"', pos);
    if (pos == std::string_view::npos) return "";
    pos++; // start of value
    
    size_t end = meta.find('"', pos);
    if (end == std::string_view::npos) return "";
    
    return meta.substr(pos, end - pos);
}

// helper to quote string for SQL
std::string sql_quote(const std::string& s) {
    std::string res;
    res.reserve(s.size() + 10);  // Pre-allocate: string + quotes + potential escapes
    res += '\'';
    for (char c : s) {
        res += c;
        if (c == '\'') res += '\'';  // Escape single quote by doubling it
    }
    res += '\'';
    return res;
}


// Get Node Dependency Graph
static void GetNodeDependencyGraph(sqlite3_context *context, int argc, sqlite3_value **argv) {
    if (argc < 1) {
        sqlite3_result_error(context, "Requires nodeId", -1);
        return;
    }
    
    const char* nodeIdRaw = (const char*)sqlite3_value_text(argv[0]);
    if (!nodeIdRaw) {
        sqlite3_result_null(context);
        return;
    }
    std::string startNodeId(nodeIdRaw);
    
    int maxDepth = 100;
    if (argc >= 2) {
        maxDepth = sqlite3_value_int(argv[1]);
    }

    sqlite3 *db = sqlite3_context_db_handle(context);
    
    std::unordered_set<std::string> visitedNodeIds;
    std::unordered_map<std::string, GraphNode> nodesMap;
    std::unordered_map<std::string, GraphConnection> connectionsMap;
    
    std::vector<std::string> currentLevelIds;
    currentLevelIds.push_back(startNodeId);
    visitedNodeIds.insert(startNodeId);
    
    // Fetch Root Node
    {
        std::string sql = "SELECT id, name, type, projectName, branch, relativePath, startLine, startColumn FROM Node WHERE id = ?";
        sqlite3_stmt* stmt;
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, NULL) == SQLITE_OK) {
            sqlite3_bind_text(stmt, 1, startNodeId.c_str(), -1, SQLITE_STATIC);
            if (sqlite3_step(stmt) == SQLITE_ROW) {
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
                
                nodesMap[n.id] = n;
            }
            sqlite3_finalize(stmt);
        }
    }
    
    // BFS
    int depth = 0;
    while (!currentLevelIds.empty() && depth < maxDepth) {
        std::string idListParam;
        for (size_t i = 0; i < currentLevelIds.size(); ++i) {
            if (i > 0) idListParam += ",";
            idListParam += sql_quote(currentLevelIds[i]);
        }
        
        if (idListParam.empty()) break;
        
        if (idListParam.empty()) break;

        // Fetch Connections
        std::string sql = "SELECT fromId, toId FROM Connection WHERE fromId IN (" + idListParam + ") OR toId IN (" + idListParam + ")";
        
        sqlite3_stmt* stmt;
        std::vector<std::string> nextLevelIds;
        std::unordered_set<std::string> newIdsToFetch;
        
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, NULL) == SQLITE_OK) {
            while (sqlite3_step(stmt) == SQLITE_ROW) {
                GraphConnection conn;
                conn.fromId = (const char*)sqlite3_column_text(stmt, 0);
                conn.toId = (const char*)sqlite3_column_text(stmt, 1);
                conn.id = conn.fromId + "-" + conn.toId; // Synthesize ID
                
                if (connectionsMap.find(conn.id) == connectionsMap.end()) {
                    connectionsMap[conn.id] = conn;
                    
                    std::string neighbor;
                    if (visitedNodeIds.count(conn.fromId) && !visitedNodeIds.count(conn.toId)) {
                        neighbor = conn.toId;
                    } else if (visitedNodeIds.count(conn.toId) && !visitedNodeIds.count(conn.fromId)) {
                        neighbor = conn.fromId;
                    }
                    
                    if (!neighbor.empty()) {
                        visitedNodeIds.insert(neighbor);
                        newIdsToFetch.insert(neighbor);
                        nextLevelIds.push_back(neighbor);
                    }
                }
            }
            sqlite3_finalize(stmt);
        }
        
        // Fetch New Nodes Info
        if (!newIdsToFetch.empty()) {
             std::string newIdListParam;
             bool first = true;
             for (const auto& id : newIdsToFetch) {
                 if (!first) newIdListParam += ",";
                 newIdListParam += sql_quote(id);
                 first = false;
             }
             
             std::string nodesSql = "SELECT id, name, type, projectName, branch, relativePath, startLine, startColumn FROM Node WHERE id IN (" + newIdListParam + ")";
             if (sqlite3_prepare_v2(db, nodesSql.c_str(), -1, &stmt, NULL) == SQLITE_OK) {
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
                     
                     nodesMap[n.id] = n;
                 }
                 sqlite3_finalize(stmt);
             }
        }
        
        currentLevelIds = nextLevelIds;
        depth++;
    }
    
    std::vector<GraphNode> nodesList;
    for (const auto& p : nodesMap) nodesList.push_back(p.second);
    std::vector<GraphConnection> connList;
    for (const auto& p : connectionsMap) connList.push_back(p.second);
    
    OrthogonalGraph og = BuildOrthogonalGraph(nodesList, connList);
    auto cycles = DetectCycles(og);
    std::string json = SerializeGraph(og, cycles);
    
    sqlite3_result_text(context, json.c_str(), -1, SQLITE_TRANSIENT);
}

// Helper struct for result
struct ProjectGraphResult {
    OrthogonalGraph graph;
    std::vector<std::vector<GraphNode>> cycles;
};

static ProjectGraphResult BuildProjectGraphImpl(sqlite3* db, std::string startProjectId, std::string branch, int maxDepth) {
    std::unordered_set<std::string> visitedProjectIds;
    std::unordered_map<std::string, GraphNode> projectInfos;
    std::unordered_map<std::string, GraphConnection> projectConnections;
    
    std::vector<std::string> currentLevelIds;
    currentLevelIds.push_back(startProjectId);
    visitedProjectIds.insert(startProjectId);
    
    // 1. Fetch Root Project
    {
         // GraphNode reused for Project info: name, addr, type
         std::string sql = "SELECT id, name, addr, type FROM Project WHERE id = ?";
         sqlite3_stmt* stmt;
         if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, NULL) == SQLITE_OK) {
             sqlite3_bind_text(stmt, 1, startProjectId.c_str(), -1, SQLITE_STATIC);
             if (sqlite3_step(stmt) == SQLITE_ROW) {
                 GraphNode p;
                 p.id = (const char*)sqlite3_column_text(stmt, 0);
                 p.name = (const char*)sqlite3_column_text(stmt, 1);
                 p.addr = (const char*)sqlite3_column_text(stmt, 2);
                 p.type = (const char*)sqlite3_column_text(stmt, 3);
                 p.branch = branch;
                 
                 projectInfos[p.id] = p;
             }
             sqlite3_finalize(stmt);
         }
    }
    
    // BFS
    int depth = 0;
    while (!currentLevelIds.empty() && depth < maxDepth) {
        std::string idListParam;
        for (size_t i = 0; i < currentLevelIds.size(); ++i) {
            if (i > 0) idListParam += ",";
            idListParam += sql_quote(currentLevelIds[i]);
        }
        
        if (idListParam.empty()) break;

        // Find connections between NODES where nodes belong to these projects
        // SELECT N1.projectId as fromPid, N2.projectId as toPid 
        // FROM Connection C 
        // JOIN Node N1 ON C.fromId = N1.id 
        // JOIN Node N2 ON C.toId = N2.id 
        // WHERE (N1.projectId IN (...) OR N2.projectId IN (...)) 
        // AND N1.branch = ? AND N2.branch = ?
        
        // Optimization: Single query 
        std::string sql = 
            "SELECT DISTINCT N1.projectId, N2.projectId "
            "FROM Connection C "
            "JOIN Node N1 ON C.fromId = N1.id "
            "JOIN Node N2 ON C.toId = N2.id "
            "WHERE (N1.projectId IN (" + idListParam + ") OR N2.projectId IN (" + idListParam + ")) "
            "AND N1.branch = ? AND N2.branch = ? "
            "AND N1.projectId != N2.projectId";
            
        sqlite3_stmt* stmt;
        std::vector<std::string> nextLevelIds;
        std::unordered_set<std::string> newProjectsToFetch;
        
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, NULL) == SQLITE_OK) {
            sqlite3_bind_text(stmt, 1, branch.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_text(stmt, 2, branch.c_str(), -1, SQLITE_STATIC);
            
            while (sqlite3_step(stmt) == SQLITE_ROW) {
                 std::string fromPid = (const char*)sqlite3_column_text(stmt, 0);
                 std::string toPid = (const char*)sqlite3_column_text(stmt, 1);
                 
                 std::string connId = fromPid + "-" + toPid;
                 if (projectConnections.find(connId) == projectConnections.end()) {
                     GraphConnection gc;
                     gc.id = connId;
                     gc.fromId = fromPid;
                     gc.toId = toPid;
                     projectConnections[connId] = gc;
                     
                     // Identify new discovery
                     if (visitedProjectIds.find(fromPid) == visitedProjectIds.end()) {
                         visitedProjectIds.insert(fromPid);
                         newProjectsToFetch.insert(fromPid);
                         nextLevelIds.push_back(fromPid);
                     }
                     if (visitedProjectIds.find(toPid) == visitedProjectIds.end()) {
                         visitedProjectIds.insert(toPid);
                         newProjectsToFetch.insert(toPid);
                         nextLevelIds.push_back(toPid);
                     }
                 }
            }
            sqlite3_finalize(stmt);
        }
        
        // Fetch newly discovered projects
        if (!newProjectsToFetch.empty()) {
             std::string pIds;
             bool first = true;
             for (const auto& pid : newProjectsToFetch) {
                 if (!first) pIds += ",";
                 pIds += sql_quote(pid);
                 first = false;
             }
             
             std::string pSql = "SELECT id, name, addr, type FROM Project WHERE id IN (" + pIds + ")";
             if (sqlite3_prepare_v2(db, pSql.c_str(), -1, &stmt, NULL) == SQLITE_OK) {
                 while (sqlite3_step(stmt) == SQLITE_ROW) {
                     GraphNode p;
                     p.id = (const char*)sqlite3_column_text(stmt, 0);
                     p.name = (const char*)sqlite3_column_text(stmt, 1);
                     p.addr = (const char*)sqlite3_column_text(stmt, 2);
                     p.type = (const char*)sqlite3_column_text(stmt, 3);
                     p.branch = branch;
                     projectInfos[p.id] = p;
                 }
                 sqlite3_finalize(stmt);
             }
        }
        
        currentLevelIds = nextLevelIds;
        depth++;
    }
    
    std::vector<GraphNode> nodesList;
    for (const auto& p : projectInfos) nodesList.push_back(p.second);
    std::vector<GraphConnection> connList;
    for (const auto& p : projectConnections) connList.push_back(p.second);
    
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
        // sqlite3_create_function(db, "auto_create_connections", 0, SQLITE_UTF8, NULL, AutoCreateConnections, NULL, NULL);
        
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
