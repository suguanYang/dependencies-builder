import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { NodesModule } from './nodes/nodes.module';
import { DependenciesModule } from './dependencies/dependencies.module';
import { ConnectionsModule } from './connections/connections.module';
import { ProjectsModule } from './projects/projects.module';
import { ActionsModule } from './actions/actions.module';
import { DatabaseAdminModule } from './database-admin/database-admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    PrismaModule,
    NodesModule,
    DependenciesModule,
    ConnectionsModule,
    ProjectsModule,
    ActionsModule,
    DatabaseAdminModule,
  ],
})
export class AppModule { }