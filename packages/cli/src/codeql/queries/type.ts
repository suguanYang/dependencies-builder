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
        "tuples": [importName: string, usageLocation: string, moduleName: string][]
    }
}

export type LibsDynamicImportQuery = {
    "#select": {
        "tuples": [importName: string, usageLocation: string, packageName: string, subPackageName: string][]
    }
}

export type GlobalVariableQuery = {
    "#select": {
        "tuples": [variableName: string, location: string, type: "Write" | "Read"][]
    }
}

export type WebStorageQuery = {
    "#select": {
        "tuples": [localStorageKey: string, location: string, type: "Write" | "Read", kind: "LocalStorage" | "SessionStorage"][]
    }
}

export type EventQuery = {
    "#select": {
        "tuples": [eventName: string, usageLocation: string, type: "On" | "Emit"][]
    }
}

export const NodeType = {
    NamedExport: 'NamedExport',
    NamedImport: 'NamedImport',
    RuntimeDynamicImport: 'RuntimeDynamicImport',
    Externals: 'Externals',
    GlobalState: 'GlobalState',
    EventOn: 'EventOn',
    EventEmit: 'EventEmit',
    DynamicModuleFederationReference: 'DynamicModuleFederationReference'
};

export type NodeType = (typeof NodeType)[keyof typeof NodeType]
