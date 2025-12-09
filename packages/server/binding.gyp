{
  "targets": [
    {
      "target_name": "sqlite_hook",
      "sources": [ "src/native/sqlite-hook.cc" ],
      "cflags_cc": [ "-std=c++17" ],
      "xcode_settings": {
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17"
      }
    }
  ]
}
