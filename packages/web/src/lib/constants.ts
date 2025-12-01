import { NodeType, AppType } from './api'
import { FileText, Box, Globe, Package, GitBranch, Link, Folder, HelpCircle } from 'lucide-react'

export const NODE_TYPE_OPTIONS = Object.values(NodeType).map((type) => ({
  value: type,
  label: type,
}))

export const NODE_CONFIG: Record<
  NodeType | AppType | 'Default',
  {
    label: string
    abbr: string
    color: string
    icon: any // Using any to avoid complex React type issues in constants
  }
> = {
  [AppType.App]: {
    label: 'Application',
    abbr: 'APP',
    color: '#3b82f6', // blue-500
    icon: Folder,
  },
  [AppType.Lib]: {
    label: 'Library',
    abbr: 'LIB',
    color: '#8b5cf6', // violet-500
    icon: Folder,
  },
  [NodeType.NamedExport]: {
    label: 'Named Export',
    abbr: 'NE',
    color: '#3b82f6', // blue-500
    icon: FileText,
  },
  [NodeType.NamedImport]: {
    label: 'Named Import',
    abbr: 'NI',
    color: '#eab308', // yellow-500
    icon: FileText,
  },
  [NodeType.RuntimeDynamicImport]: {
    label: 'Runtime Dynamic Import',
    abbr: 'RDI',
    color: '#ec4899', // pink-500
    icon: Box,
  },
  [NodeType.GlobalVarRead]: {
    label: 'Global Var Read',
    abbr: 'GR',
    color: '#8b5cf6', // violet-500
    icon: Globe,
  },
  [NodeType.GlobalVarWrite]: {
    label: 'Global Var Write',
    abbr: 'GW',
    color: '#10b981', // emerald-500
    icon: Globe,
  },
  [NodeType.WebStorageRead]: {
    label: 'Web Storage Read',
    abbr: 'WR',
    color: '#f97316', // orange-500
    icon: Package,
  },
  [NodeType.WebStorageWrite]: {
    label: 'Web Storage Write',
    abbr: 'WW',
    color: '#22c5e0', // green-500
    icon: Package,
  },
  [NodeType.EventOn]: {
    label: 'Event On',
    abbr: 'EO',
    color: '#06b6d4', // cyan-500
    icon: GitBranch,
  },
  [NodeType.EventEmit]: {
    label: 'Event Emit',
    abbr: 'EE',
    color: '#ef4444', // red-500
    icon: GitBranch,
  },
  [NodeType.DynamicModuleFederationReference]: {
    label: 'Dynamic Module Federation',
    abbr: 'DMF',
    color: '#8b5cf6', // violet-500
    icon: Link,
  },
  [NodeType.UrlParamRead]: {
    label: 'URL Param Read',
    abbr: 'UPR',
    color: '#f59e0b', // amber-500
    icon: Globe,
  },
  [NodeType.UrlParamWrite]: {
    label: 'URL Param Write',
    abbr: 'UPW',
    color: '#10b981', // emerald-500
    icon: Globe,
  },
  Default: {
    label: 'Unknown',
    abbr: '?',
    color: '#6b7280', // gray-500
    icon: HelpCircle,
  },
}
