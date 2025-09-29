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
    "#select": {
        "tuples": [entry: string, name: string, location: string][]
    }
}

export type ImportQuery = {
    "#select": {
        "tuples": [importName: string, moduleName: string, usageLocation: string][]
    }
}

export type LibsDynamicImportQuery = {
    "#select": {
        "tuples": [importName: string, packageName: string, subPackageName: string, usageLocation: string][]
    }
}

export type GlobalVariableQuery = {
    "#select": {
        "tuples": [variableName: string, type: "Write" | "Read", location: string][]
    }
}

export type WebStorageQuery = {
    "#select": {
        "tuples": [localStorageKey: string, type: "Write" | "Read", kind: "LocalStorage" | "SessionStorage", location: string][]
    }
}

export type EventQuery = {
    "#select": {
        "tuples": [eventName: string, type: "On" | "Emit", usageLocation: string][]
    }
}

export const NodeType = {
    NamedExport: 'NamedExport',
    NamedImport: 'NamedImport',
    RuntimeDynamicImport: 'RuntimeDynamicImport',
    GlobalVarRead: 'GlobalVarRead',
    GlobalVarWrite: 'GlobalVarWrite',
    WebStorageRead: 'WebStorageRead',
    WebStorageWrite: 'WebStorageWrite',
    EventOn: 'EventOn',
    EventEmit: 'EventEmit',
    DynamicModuleFederationReference: 'DynamicModuleFederationReference'
};

export type NodeType = (typeof NodeType)[keyof typeof NodeType]
