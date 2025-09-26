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
        "tuples": [variableName: string, usageLocation: string][]
    }
}

export type EventOnQuery = {
    "#select": {
        "tuples": [eventName: string, usageLocation: string][]
    }
}

export type EventEmitQuery = {
    "#select": {
        "tuples": [eventName: string, usageLocation: string][]
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
