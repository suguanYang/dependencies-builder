import { AppType } from '../../generated/prisma/client';

export class ProjectQueryDto {
  name?: string;
  addr?: string;
  take?: number;
  skip?: number;
  type?: AppType;
}