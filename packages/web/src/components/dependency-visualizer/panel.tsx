import React from 'react';
import { D3Node, EntityType } from '../types';
import { X, GitBranch, Box, Globe, Folder, Package, Link, Calendar, FileText, MapPin } from 'lucide-react';
import { AppType } from '@/lib/api';

interface NodePanelProps {
  node: D3Node | null;
  onClose: () => void;
}

const NodeIcon = ({ type }: { type: EntityType }) => {
  // Handle AppType first
  if (type === AppType.App || type === AppType.Lib) {
    return <Folder className="w-5 h-5 text-violet-500" />;
  }

  // Handle NodeType
  switch (type) {
    case 'NamedExport':
    case 'NamedImport':
      return <FileText className="w-5 h-5 text-green-500" />;
    case 'RuntimeDynamicImport':
      return <Box className="w-5 h-5 text-orange-500" />;
    case 'GlobalVarRead':
    case 'GlobalVarWrite':
      return <Globe className="w-5 h-5 text-red-500" />;
    case 'WebStorageRead':
    case 'WebStorageWrite':
      return <Package className="w-5 h-5 text-purple-500" />;
    case 'EventOn':
    case 'EventEmit':
      return <GitBranch className="w-5 h-5 text-yellow-500" />;
    case 'DynamicModuleFederationReference':
      return <Link className="w-5 h-5 text-cyan-500" />;
    default:
      return <Box className="w-5 h-5 text-gray-500" />;
  }
};

const NodePanel: React.FC<NodePanelProps> = ({ node, onClose }) => {
  if (!node) return null;

  const isProject = node.type === AppType.App || node.type === AppType.Lib;
  const projectType = isProject ? (node.type === AppType.App ? 'APP' : 'LIB') : null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatSourceLocation = () => {
    if (node.relativePath === undefined) return 'N/A';
    const location = [node.relativePath];
    if (node.startLine !== undefined) {
      location.push(`${node.startLine}`);
      if (node.startColumn !== undefined) {
        location.push(`${node.startColumn}`);
      }
    }
    return location.join(':');
  };

  return (
    <div className="absolute top-4 right-4 w-96 bg-white/95 backdrop-blur shadow-xl rounded-xl border border-slate-200 z-10 overflow-hidden animate-in slide-in-from-right-2 fade-in duration-300">
      <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 flex-shrink-0">
            <NodeIcon type={node.type} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-800 text-lg leading-tight truncate" title={node.name}>
              {node.name}
            </h2>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {isProject ? `${projectType} PROJECT` : node.type}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {isProject ? (
          // Project-specific information
          <>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Project Type</label>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                {projectType === 'APP' ? 'Application' : 'Library'}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Repository Address</label>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span className="truncate" title={node.addr || 'N/A'}>{node.addr || 'N/A'}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Branch</label>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                {node.branch}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</label>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                {formatDate(node.createdAt)}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Updated</label>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                {formatDate(node.updatedAt)}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Project ID</label>
              <p className="text-xs font-mono text-slate-500 bg-slate-100 p-2 rounded border border-slate-200 break-all">
                {node.id}
              </p>
            </div>
          </>
        ) : (
          // Node-specific information
          <>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Project</label>
              <p className="text-sm font-medium text-slate-700 truncate" title={node.projectName}>{node.projectName}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Branch</label>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                {node.branch}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Node Type</label>
              <p className="text-sm font-medium text-slate-700">{node.type}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Source Location</label>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span className="truncate" title={formatSourceLocation()}>{formatSourceLocation()}</span>
              </div>
            </div>

            {node.meta && Object.keys(node.meta).length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Metadata</label>
                <div className="text-xs font-mono text-slate-500 bg-slate-100 p-2 rounded border border-slate-200">
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(node.meta, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Node ID</label>
              <p className="text-xs font-mono text-slate-500 bg-slate-100 p-2 rounded border border-slate-200 break-all">
                {node.id}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NodePanel;
