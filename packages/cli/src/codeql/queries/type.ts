// {
//     "#select": {
//        "columns": [
//           {
//              "name": "entry",
//              "kind": "String"
//           },
//           {
//              "name": "name",
//              "kind": "String"
//           },
//           {
//              "name": "location",
//              "kind": "String"
//           }
//        ],
//        "tuples": [
//           [
//              "ui/schemas/index.ts",
//              "UdcToolBar",
//              "ui/schemas/tool-bar.ts:160:27"
//           ]
//        ]
//     }
//  }
export type ExportQuery = {
  '#select': {
    tuples: [entry: string, name: string, location: string][]
  }
}

export type ImportQuery = {
  '#select': {
    tuples: [moduleName: string, importName: string, usageLocation: string][]
  }
}

export type LibsDynamicImportQuery = {
  '#select': {
    tuples: [
      packageName: string,
      subPackageName: string,
      importName: string,
      usageLocation: string,
    ][]
  }
}

export type GlobalVariableQuery = {
  '#select': {
    tuples: [variableName: string, type: 'Write' | 'Read', location: string][]
  }
}

export type WebStorageQuery = {
  '#select': {
    tuples: [
      localStorageKey: string,
      type: 'Write' | 'Read',
      kind: 'LocalStorage' | 'SessionStorage',
      location: string,
    ][]
  }
}

export type EventQuery = {
  '#select': {
    tuples: [eventName: string, type: 'On' | 'Emit', usageLocation: string][]
  }
}

export type RemoteLoaderQuery = {
  '#select': {
    tuples: [appName: string, moduleName: string, location: string][]
  }
}

export type UrlParamQuery = {
  '#select': {
    tuples: [paramName: string, type: 'UrlParamRead' | 'UrlParamWrite', location: string][]
  }
}
