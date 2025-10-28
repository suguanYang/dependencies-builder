export class ConnectionQueryDto {
  fromId?: string;
  toId?: string;
  fromNodeName?: string;
  toNodeName?: string;
  fromNodeProjectName?: string;
  toNodeProjectName?: string;
  fromNodeType?: string;
  toNodeType?: string;
  take?: number;
  skip?: number;
}