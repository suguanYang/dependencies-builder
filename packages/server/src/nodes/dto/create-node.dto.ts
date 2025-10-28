import { NodeType } from '../../generated/prisma/client';

export class CreateNodeDto {
  name!: string;
  branch!: string;
  projectName!: string;
  projectId!: string;
  version!: string;
  type!: NodeType;
  relativePath!: string;
  startLine!: number;
  startColumn!: number;
  endLine!: number;
  endColumn!: number;
  meta!: any;
}