#include <node_api.h>
#include <string.h>
#include <stdlib.h>
#include "sqlite3ext.h"
#include <stdio.h>

#ifdef _WIN32
  #define DLLEXPORT __declspec(dllexport)
#else
  #define DLLEXPORT __attribute__((visibility("default")))
#endif

SQLITE_EXTENSION_INIT1


// Global reference to the ThreadSafeFunction
napi_threadsafe_function tsfn = NULL;

// SQLite update hook callback
void UpdateHook(void* user_data, int operation, const char* database, const char* table, sqlite3_int64 rowid) {
    // We only care about the "Node" table
    if (table && strcmp(table, "Node") == 0) {

        printf("table: %s", table);
        if (tsfn != NULL) {
            // Call the JS callback
            // We pass NULL for the data because we don't need to pass any specific data to the JS function
            napi_call_threadsafe_function(tsfn, NULL, napi_tsfn_nonblocking);
        }
    }
}

// NAPI setup function
napi_value Setup(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_value this_arg;
    void* data;

    napi_status status = napi_get_cb_info(env, info, &argc, args, &this_arg, &data);
    if (status != napi_ok) return NULL;

    if (argc < 1) {
        napi_throw_type_error(env, NULL, "Function expected");
        return NULL;
    }

    napi_value resource_name;
    napi_create_string_utf8(env, "SQLiteUpdateHook", NAPI_AUTO_LENGTH, &resource_name);

    // Create a ThreadSafeFunction from the JS callback
    status = napi_create_threadsafe_function(
        env,
        args[0],
        NULL,
        resource_name,
        0,
        1,
        NULL,
        NULL,
        NULL,
        NULL,
        &tsfn
    );

    if (status != napi_ok) {
        napi_throw_error(env, NULL, "Failed to create threadsafe function");
        return NULL;
    }

    // Allow Node to exit if this is the only thing running
    napi_unref_threadsafe_function(env, tsfn);

    return NULL;
}

// SQLite extension entry point
#ifdef __cplusplus
extern "C" {
#endif
    DLLEXPORT int sqlite3_extension_init(
        sqlite3 *db, 
        char **pzErrMsg, 
        const sqlite3_api_routines *pApi
    ) {
        SQLITE_EXTENSION_INIT2(pApi);
        
        // Register the update hook
        sqlite3_update_hook(db, UpdateHook, NULL);
        
        return SQLITE_OK;
    }
#ifdef __cplusplus
}
#endif

// NAPI initialization
napi_value Init(napi_env env, napi_value exports) {
    napi_value setup_fn;
    napi_create_function(env, "setup", NAPI_AUTO_LENGTH, Setup, NULL, &setup_fn);
    napi_set_named_property(env, exports, "setup", setup_fn);
    return exports;
}

NAPI_MODULE(sqlite_hook, Init)
