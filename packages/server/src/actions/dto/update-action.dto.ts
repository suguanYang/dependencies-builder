export class UpdateActionDto {
  status?: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}