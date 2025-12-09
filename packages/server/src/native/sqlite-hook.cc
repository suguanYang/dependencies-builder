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

// --- New AutoCreateConnections Logic ---

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

static void AutoCreateConnections(sqlite3_context *context, int argc, sqlite3_value **argv) {
    sqlite3 *db = sqlite3_context_db_handle(context);
    
    int createdCount = 0;
    int skippedCount = 0;
    std::vector<std::string> errors;
    
    // 1. Load Nodes
    std::vector<Node> nodes;
    std::unordered_map<std::string, std::vector<Node*>> nodesByType;
    
    // Indexes
    std::unordered_map<std::string, std::vector<Node*>> namedExportsIndex; // Key: proj:name:branch
    std::unordered_map<std::string, std::vector<Node*>> namedExportsByEntryIndex; // Key: proj:entry:branch
    std::unordered_map<std::string, std::vector<Node*>> genericWriteIndex; // Key: type:name:branch

    // Optimization: Reserve capacity to avoid reallocations
    sqlite3_stmt *countStmt;
    if (sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM Node", -1, &countStmt, NULL) == SQLITE_OK) {
        if (sqlite3_step(countStmt) == SQLITE_ROW) {
            int count = sqlite3_column_int(countStmt, 0);
            nodes.reserve(count);
        }
        sqlite3_finalize(countStmt);
    }

    sqlite3_stmt *stmt;
    int rc = sqlite3_prepare_v2(db, "SELECT id, type, name, projectName, branch, meta FROM Node", -1, &stmt, NULL);
    if (rc != SQLITE_OK) {
        std::string err = "Failed to select nodes: ";
        err += sqlite3_errmsg(db);
        sqlite3_result_error(context, err.c_str(), -1);
        return;
    }

    while (sqlite3_step(stmt) == SQLITE_ROW) {
        Node n;
        n.id = (const char*)sqlite3_column_text(stmt, 0);
        n.type = (const char*)sqlite3_column_text(stmt, 1);
        n.name = (const char*)sqlite3_column_text(stmt, 2);
        n.projectName = (const char*)sqlite3_column_text(stmt, 3);
        n.branch = (const char*)sqlite3_column_text(stmt, 4);
        const char* metaRaw = (const char*)sqlite3_column_text(stmt, 5);
        n.meta = metaRaw ? metaRaw : "";
        
        nodes.push_back(n);
    }
    sqlite3_finalize(stmt);
    
    // Re-iterate pointers to build maps (avoid copying strings around too much in maps)
    // Note: 'nodes' vector address might be unstable during push_back, but we finished pushing.
    // So pointers are stable now.
    for (size_t i = 0; i < nodes.size(); ++i) {
        Node* node = &nodes[i];
        
        nodesByType[node->type].push_back(node);
        
        if (node->type == "NamedExport") {
            // Rule 1 & 2 Index
            std::string key = node->projectName + ":" + node->name + ":" + node->branch;
            namedExportsIndex[key].push_back(node);
            
            // Rule 6 Index (entryName)
            std::string_view entryName = getEntryName(node->meta);
            if (!entryName.empty()) {
                std::string entryKey = node->projectName + ":" + std::string(entryName) + ":" + node->branch;
                namedExportsByEntryIndex[entryKey].push_back(node);
            }
        } else if (node->type == "GlobalVarWrite" || 
                   node->type == "WebStorageWrite" || 
                   node->type == "UrlParamWrite" || 
                   node->type == "EventEmit") {
            std::string key = node->type + ":" + node->name + ":" + node->branch;
            genericWriteIndex[key].push_back(node);
        }
    }

    // 2. Load Existing Connections
    std::unordered_set<std::string> existingConnectionSet;
    rc = sqlite3_prepare_v2(db, "SELECT fromId, toId FROM Connection", -1, &stmt, NULL);
    if (rc != SQLITE_OK) {
         // handle error
    } else {
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            std::string from = (const char*)sqlite3_column_text(stmt, 0);
            std::string to = (const char*)sqlite3_column_text(stmt, 1);
            existingConnectionSet.insert(from + ":" + to);
        }
        sqlite3_finalize(stmt);
    }

    // 3. Match Logic
    struct NewConn { std::string from; std::string to; };
    std::vector<NewConn> toCreate;

    auto processMatch = [&](Node* fromNode, const std::vector<Node*>& toNodes) {
        for (Node* toNode : toNodes) {
            if (fromNode->projectName == toNode->projectName) continue;

            // Rule 1 specific check: es6 imports from index/seeyon_ui_index
            if (fromNode->type == "NamedImport" && toNode->type == "NamedExport") {
                std::string_view entryName = getEntryName(toNode->meta);
                if (entryName != "index" && entryName != "seeyon_ui_index" && entryName != "seeyon_mui_index") {
                    continue;
                }
            }
            
            std::string connKey = fromNode->id + ":" + toNode->id;
            if (existingConnectionSet.find(connKey) == existingConnectionSet.end()) {
                toCreate.push_back({fromNode->id, toNode->id});
                existingConnectionSet.insert(connKey); // Avoid dups in same batch
            } else {
                skippedCount++;
            }
        }
    };

    // Rule 1: NamedImport -> NamedExport
    if (nodesByType.count("NamedImport")) {
        for (Node* importNode : nodesByType["NamedImport"]) {
            // Split name dot
            size_t dotPos = importNode->name.find('.');
            if (dotPos == std::string::npos) continue;
            
            std::string_view nameView(importNode->name);
            std::string_view pkgName = nameView.substr(0, dotPos);
            std::string_view impName = nameView.substr(dotPos + 1);
            
            std::string key = std::string(pkgName) + ":" + std::string(impName) + ":" + importNode->branch;
            if (namedExportsIndex.count(key)) {
                processMatch(importNode, namedExportsIndex[key]);
            }
        }
    }
    
    // Rule 2: RuntimeDynamicImport -> NamedExport
    if (nodesByType.count("RuntimeDynamicImport")) {
        for (Node* importNode : nodesByType["RuntimeDynamicImport"]) {
            // "packageName.something.importName" -> need parts[0] and parts[2]
            
            size_t pos1 = importNode->name.find('.');
            if (pos1 == std::string::npos) continue;
            
            size_t pos2 = importNode->name.find('.', pos1 + 1);
            if (pos2 == std::string::npos) continue;
            
            // parts[0] is 0..pos1
            // parts[2] is diff based on if there is a 3rd dot
            size_t pos3 = importNode->name.find('.', pos2 + 1);
            
            std::string_view nameView(importNode->name);
            std::string_view pkgName = nameView.substr(0, pos1);
            std::string_view impName;
            
            if (pos3 == std::string::npos) {
                impName = nameView.substr(pos2 + 1);
            } else {
                impName = nameView.substr(pos2 + 1, pos3 - (pos2 + 1));
            }
            
            std::string key = std::string(pkgName) + ":" + std::string(impName) + ":" + importNode->branch;
            if (namedExportsIndex.count(key)) {
                processMatch(importNode, namedExportsIndex[key]);
            }
        }
    }
    
    // Rule 3: GlobalVarRead -> GlobalVarWrite
    if (nodesByType.count("GlobalVarRead")) {
        for (Node* readNode : nodesByType["GlobalVarRead"]) {
            std::string key = "GlobalVarWrite:" + readNode->name + ":" + readNode->branch;
            if (genericWriteIndex.count(key)) {
                processMatch(readNode, genericWriteIndex[key]);
            }
        }
    }

    // Rule 4: WebStorageRead -> WebStorageWrite
    if (nodesByType.count("WebStorageRead")) {
        for (Node* readNode : nodesByType["WebStorageRead"]) {
            std::string key = "WebStorageWrite:" + readNode->name + ":" + readNode->branch;
            if (genericWriteIndex.count(key)) {
                processMatch(readNode, genericWriteIndex[key]);
            }
        }
    }

    // Rule 5: EventOn -> EventEmit
    if (nodesByType.count("EventOn")) {
        for (Node* readNode : nodesByType["EventOn"]) {
            std::string key = "EventEmit:" + readNode->name + ":" + readNode->branch;
            if (genericWriteIndex.count(key)) {
                processMatch(readNode, genericWriteIndex[key]);
            }
        }
    }

    // Rule 7: UrlParamRead -> UrlParamWrite
    if (nodesByType.count("UrlParamRead")) {
        for (Node* readNode : nodesByType["UrlParamRead"]) {
            std::string key = "UrlParamWrite:" + readNode->name + ":" + readNode->branch;
            if (genericWriteIndex.count(key)) {
                processMatch(readNode, genericWriteIndex[key]);
            }
        }
    }

    // Rule 6: DynamicModuleFederationReference -> NamedExport
    if (nodesByType.count("DynamicModuleFederationReference")) {
        for (Node* refNode : nodesByType["DynamicModuleFederationReference"]) {
            size_t dotPos = refNode->name.find('.');
            if (dotPos == std::string::npos) continue;
            
            std::string_view nameView(refNode->name);
            std::string_view refProj = nameView.substr(0, dotPos);
            std::string_view refName = nameView.substr(dotPos + 1);
            
            std::string key = std::string(refProj) + ":" + std::string(refName) + ":" + refNode->branch;
            if (namedExportsByEntryIndex.count(key)) {
                processMatch(refNode, namedExportsByEntryIndex[key]);
            }
        }
    }
    
    // 4. Batch Insert
    if (!toCreate.empty()) {
        sqlite3_exec(db, "BEGIN TRANSACTION", NULL, NULL, NULL);
        // Removed 'id' column, using composite PK
        rc = sqlite3_prepare_v2(db, "INSERT INTO Connection (fromId, toId) VALUES (?, ?)", -1, &stmt, NULL);
        
        for (const auto& c : toCreate) {
            sqlite3_reset(stmt);
            sqlite3_bind_text(stmt, 1, c.from.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_text(stmt, 2, c.to.c_str(), -1, SQLITE_STATIC);
            
            if (sqlite3_step(stmt) != SQLITE_DONE) {
                errors.push_back(sqlite3_errmsg(db));
            } else {
                createdCount++;
            }
        }
        sqlite3_finalize(stmt);
        sqlite3_exec(db, "COMMIT", NULL, NULL, NULL);
    }
    
    // 5. Cycle Detection (Iterative DFS)
    // Re-build graph from existing + created
    // Or just update graph if we were tracking edge insertions.
    // Let's just do a clean pass over `existingConnectionSet`.
    std::unordered_map<std::string, std::vector<std::string>> graph;
    for (const std::string& key : existingConnectionSet) {
        size_t colon = key.find(':');
        std::string u = key.substr(0, colon);
        std::string v = key.substr(colon + 1);
        graph[u].push_back(v);
    }
    
    std::vector<std::string> cyclesFound;
    std::unordered_set<std::string> visited;
    
    for (const auto& kv : graph) {
        std::string startNode = kv.first;
        if (visited.count(startNode)) continue;
        
        // Stack elements: { u, children, idx }
        struct Frame {
            std::string u;
            const std::vector<std::string>* children;
            size_t idx;
        };
        
        std::vector<Frame> stack;
        std::unordered_set<std::string> onPath;
        std::vector<std::string> path; // for creating cycle string
        
        // Init stack
        stack.push_back({startNode, &graph[startNode], 0});
        
        while (!stack.empty()) {
            Frame& top = stack.back();
            
            if (top.idx == 0) {
                // Pre-visit
                if (visited.count(top.u)) {
                    stack.pop_back();
                    continue;
                }
                visited.insert(top.u);
                onPath.insert(top.u);
                path.push_back(top.u);
            }
            
            // Check children
            // Need to handle missing children in map safely
            if (!top.children) {
                 // Should have set generic pointer for leaf
                 // If graph[u] doesn't exist, children is null/empty?
                 // kv iteration guarantees startNode has edges.
                 // But newly discovered children might not.
            }

            if (top.children && top.idx < top.children->size()) {
                std::string v = (*top.children)[top.idx];
                top.idx++;
                
                if (onPath.count(v)) {
                    // Cycle found: reconstruct path + v
                    std::string cycleStr = "[";
                    bool startPrint = false;
                    for(const auto& p : path) {
                        if (p == v) startPrint = true;
                        if (startPrint) {
                            cycleStr += "\"" + p + "\",";
                        }
                    }
                    cycleStr += "\"" + v + "\"]"; // Close cycle
                    cyclesFound.push_back(cycleStr);
                } else if (!visited.count(v)) {
                    // Push v
                    const std::vector<std::string>* nextChildren = NULL;
                    if (graph.count(v)) nextChildren = &graph[v];
                    stack.push_back({v, nextChildren, 0});
                }
            } else {
                // Post-visit
                onPath.erase(top.u);
                path.pop_back();
                stack.pop_back();
            }
        }
    }
    
    // 6. Return Result JSON
    std::string json = "{";
    json += "\"createdConnections\":" + std::to_string(createdCount) + ",";
    json += "\"skippedConnections\":" + std::to_string(skippedCount) + ",";
    
    json += "\"cycles\":[";
    for (size_t i = 0; i < cyclesFound.size(); ++i) {
        if (i > 0) json += ",";
        json += cyclesFound[i];
    }
    json += "],";
    
    json += "\"errors\":[";
    for (size_t i = 0; i < errors.size(); ++i) {
        if (i > 0) json += ",";
        json += "\"" + errors[i] + "\"";
    }
    json += "]}";
    
    sqlite3_result_text(context, json.c_str(), -1, SQLITE_TRANSIENT);
}

// --- Entry Points ---

#ifdef __cplusplus
extern "C" {
#endif
    DLLEXPORT int sqlite3_extension_init(
        sqlite3 *db, 
        char **pzErrMsg, 
        const sqlite3_api_routines *pApi
    ) {
        SQLITE_EXTENSION_INIT2(pApi);
        // sqlite3_update_hook(db, UpdateHook, NULL);
        
        sqlite3_create_function(db, "auto_create_connections", 0, SQLITE_UTF8, NULL, AutoCreateConnections, NULL, NULL);

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
