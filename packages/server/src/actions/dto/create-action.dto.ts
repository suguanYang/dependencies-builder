export class CreateActionDto {
  projectAddr!: string;
  projectName!: string;
  branch!: string;
  type!: 'static_analysis' | 'report' | 'connection_auto_create';
  targetBranch!: string;
}