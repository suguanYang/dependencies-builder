import { AppType } from '../../generated/prisma/client';

export class CreateProjectDto {
  name!: string;
  addr!: string;
  entries?: Record<string, any>;
  type!: AppType;
}