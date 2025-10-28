import { Module } from '@nestjs/common';
import { DatabaseAdminController } from './database-admin.controller';
import { DatabaseAdminService } from './database-admin.service';

@Module({
  controllers: [DatabaseAdminController],
  providers: [DatabaseAdminService],
  exports: [DatabaseAdminService],
})
export class DatabaseAdminModule {}