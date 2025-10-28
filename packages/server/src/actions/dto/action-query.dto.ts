export class ActionQueryDto {
  type?: 'static_analysis' | 'report' | 'connection_auto_create';
  status?: 'pending' | 'running' | 'completed' | 'failed';
  take?: number;
  skip?: number;
}