import { NodeType } from '../../generated/prisma/client';

export class UpdateNodeDto {
  name?: string;
  branch?: string;
  projectName?: string;
  version?: string;
  type?: NodeType;
  relativePath?: string;
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
  meta?: any;
}