# Fastify to NestJS Migration Plan

## Overview

This document outlines the detailed plan for migrating the current Fastify-based server to NestJS. The migration will preserve all existing functionality while leveraging NestJS's robust architecture and dependency injection system.

## Current Architecture Analysis

### Current Tech Stack
- **Framework**: Fastify 5.6.0
- **Database**: Prisma with SQLite
- **Authentication**: Better Auth
- **Logging**: Pino
- **Testing**: Vitest
- **Worker System**: Piscina
- **Build Tool**: Vite

### Key Components to Migrate
1. **API Routes** → NestJS Controllers
2. **Authentication Middleware** → NestJS Guards
3. **Database Layer** → NestJS Services with Prisma
4. **Worker System** → NestJS Background Workers
5. **Configuration** → NestJS ConfigModule
6. **Error Handling** → NestJS Exception Filters
7. **Testing** → Jest with NestJS Testing Utilities

## Migration Strategy

### Phase 1: Foundation Setup (Week 1)

#### 1.1 Install NestJS Dependencies
```bash
# From the project root (using pnpm workspace)
pnpm --filter server add @nestjs/core @nestjs/common @nestjs/platform-fastify @nestjs/config
pnpm --filter server add @nestjs/swagger @nestjs/testing
pnpm --filter server add @thallesp/nestjs-better-auth

# Or from the server package directory
cd packages/server
pnpm add @nestjs/core @nestjs/common @nestjs/platform-fastify @nestjs/config
pnpm add @nestjs/swagger @nestjs/testing
pnpm add @thallesp/nestjs-better-auth
```

#### 1.2 Create Basic NestJS Structure
- Create `src/main.ts` with NestJS bootstrap
- Create `src/app.module.ts` as root module
- Set up `@nestjs/config` for environment variables
- Configure Fastify adapter for compatibility

#### 1.3 Database Layer Migration
- Create `PrismaModule` for database connection
- Convert repository pattern to NestJS services
- Implement dependency injection for Prisma client

### Phase 2: Authentication Migration (Week 2)

#### 2.1 Better Auth Integration
```typescript
// main.ts - Disable body parser for Better Auth
const app = await NestFactory.create(AppModule, {
  bodyParser: false,
});

// app.module.ts
@Module({
  imports: [
    AuthModule.forRoot({ auth }),
  ],
})
export class AppModule {}
```

#### 2.2 Convert Authentication Middleware
- Convert Fastify middleware to NestJS guards
- Implement role-based access control with custom decorators
- Migrate API key authentication

#### 2.3 Session Management
- Replace Fastify session handling with NestJS session management
- Implement custom decorators for session access

### Phase 3: API Layer Migration (Week 3-4)

#### 3.1 Route Controllers
Convert each Fastify route to NestJS controllers:

- `auth.ts` → `AuthController`
- `nodes.ts` → `NodesController`
- `connections.ts` → `ConnectionsController`
- `dependencies.ts` → `DependenciesController`
- `actions.ts` → `ActionsController`
- `projects.ts` → `ProjectsController`
- `database-admin.ts` → `DatabaseAdminController`

#### 3.2 Request/Response Handling
- Convert Fastify request/response objects to NestJS decorators
- Implement DTOs for request validation
- Set up proper response serialization

#### 3.3 Error Handling
- Replace manual error handling with NestJS exception filters
- Implement global exception filter for consistent error responses

### Phase 4: Service Layer Migration (Week 5)

#### 4.1 Business Logic Services
Convert existing service files to NestJS services:

- `dependency/graph.ts` → `DependencyGraphService`
- `services/process.ts` → `ProcessService`
- `services/cli.ts` → `CliService`
- `services/connection.ts` → `ConnectionService`

#### 4.2 Dependency Injection
- Implement proper dependency injection throughout the application
- Create service interfaces for better testability
- Set up module boundaries and exports

### Phase 5: Worker System Migration (Week 6)

#### 5.1 Background Processing
- Migrate Piscina workers to NestJS background workers
- Implement job queues using Bull or similar
- Create worker services with proper error handling

#### 5.2 Action Management
- Convert action execution to NestJS services
- Implement proper job monitoring and status tracking

### Phase 6: Configuration & Testing (Week 7)

#### 6.1 Configuration Management
- Migrate environment handling to ConfigModule
- Implement configuration validation
- Set up different configurations for development/production

#### 6.2 Testing Migration
- Convert Vitest tests to Jest
- Implement proper dependency injection in tests
- Create integration tests for all controllers and services
- Set up test database and fixtures

## Detailed Implementation Steps

### Step 1: Project Setup

#### 1.1 Update package.json
```json
{
  "scripts": {
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "build": "nest build",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage"
  }
}
```

**Note**: These scripts will work with pnpm as they use the NestJS CLI directly. To run the application:
```bash
# From the project root
pnpm --filter server start:dev

# Or from the server package directory
pnpm start:dev
```

#### 1.2 Create NestJS Main File
```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bodyParser: false } // Required for Better Auth
  );

  // Global validation
  app.useGlobalPipes(new ValidationPipe());

  // CORS
  app.enableCors({
    origin: process.env.CLIENT_DOMAIN || 'http://localhost:3001',
    credentials: true,
  });

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}

bootstrap();
```

### Step 2: Database Module

#### 2.1 Prisma Module
```typescript
// src/database/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

// src/database/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### Step 3: Authentication Setup

#### 3.1 Better Auth Configuration
```typescript
// src/auth/auth.config.ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  trustedOrigins: [process.env.CLIENT_DOMAIN || 'http://localhost:3001'],
});

// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth.config';

@Module({
  imports: [
    BetterAuthModule.forRoot({ auth }),
  ],
  exports: [BetterAuthModule],
})
export class AuthModule {}
```

#### 3.2 Custom Guards
```typescript
// src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserSession } from '@thallesp/nestjs-better-auth';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.session?.user as UserSession;

    return requiredRoles.some((role) => user?.role === role);
  }
}

// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### Step 4: Controller Migration Examples

#### 4.1 Nodes Controller
```typescript
// src/nodes/nodes.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { NodesService } from './nodes.service';
import { CreateNodeDto, UpdateNodeDto } from './dto';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';

@Controller('nodes')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get()
  async findAll(
    @Session() session: UserSession,
    @Query('projectId') projectId: string,
  ) {
    return this.nodesService.findAll(session.user.id, projectId);
  }

  @Post()
  async create(
    @Session() session: UserSession,
    @Body() createNodeDto: CreateNodeDto,
  ) {
    return this.nodesService.create(session.user.id, createNodeDto);
  }

  @Put(':id')
  async update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() updateNodeDto: UpdateNodeDto,
  ) {
    return this.nodesService.update(session.user.id, id, updateNodeDto);
  }

  @Delete(':id')
  async remove(
    @Session() session: UserSession,
    @Param('id') id: string,
  ) {
    return this.nodesService.remove(session.user.id, id);
  }
}
```

#### 4.2 Dependencies Controller
```typescript
// src/dependencies/dependencies.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { DependenciesService } from './dependencies.service';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';

@Controller('dependencies')
export class DependenciesController {
  constructor(private readonly dependenciesService: DependenciesService) {}

  @Get('graph')
  async getDependencyGraph(
    @Session() session: UserSession,
    @Query('projectId') projectId: string,
    @Query('nodeId') nodeId?: string,
  ) {
    return this.dependenciesService.getDependencyGraph(session.user.id, projectId, nodeId);
  }

  @Get('impact')
  async getImpactAnalysis(
    @Session() session: UserSession,
    @Query('projectId') projectId: string,
    @Query('nodeId') nodeId: string,
  ) {
    return this.dependenciesService.getImpactAnalysis(session.user.id, projectId, nodeId);
  }
}
```

### Step 5: Service Layer Migration

#### 5.1 Nodes Service
```typescript
// src/nodes/nodes.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateNodeDto, UpdateNodeDto } from './dto';

@Injectable()
export class NodesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, projectId: string) {
    return this.prisma.node.findMany({
      where: {
        project: {
          id: projectId,
          userId,
        },
      },
      include: {
        incomingConnections: true,
        outgoingConnections: true,
      },
    });
  }

  async create(userId: string, createNodeDto: CreateNodeDto) {
    return this.prisma.node.create({
      data: {
        ...createNodeDto,
        project: {
          connect: {
            id: createNodeDto.projectId,
            userId,
          },
        },
      },
    });
  }

  async update(userId: string, id: string, updateNodeDto: UpdateNodeDto) {
    const node = await this.prisma.node.findFirst({
      where: {
        id,
        project: {
          userId,
        },
      },
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    return this.prisma.node.update({
      where: { id },
      data: updateNodeDto,
    });
  }

  async remove(userId: string, id: string) {
    const node = await this.prisma.node.findFirst({
      where: {
        id,
        project: {
          userId,
        },
      },
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    return this.prisma.node.delete({
      where: { id },
    });
  }
}
```

### Step 6: Module Organization

#### 6.1 App Module
```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { NodesModule } from './nodes/nodes.module';
import { DependenciesModule } from './dependencies/dependencies.module';
import { ProjectsModule } from './projects/projects.module';
import { ActionsModule } from './actions/actions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    NodesModule,
    DependenciesModule,
    ProjectsModule,
    ActionsModule,
  ],
})
export class AppModule {}
```

#### 6.2 Feature Modules
```typescript
// src/nodes/nodes.module.ts
import { Module } from '@nestjs/common';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';

@Module({
  controllers: [NodesController],
  providers: [NodesService],
  exports: [NodesService],
})
export class NodesModule {}
```

## Testing Strategy

### Unit Tests
```typescript
// src/nodes/nodes.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NodesService } from './nodes.service';
import { PrismaService } from '../database/prisma.service';

describe('NodesService', () => {
  let service: NodesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodesService,
        {
          provide: PrismaService,
          useValue: {
            node: {
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<NodesService>(NodesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### Integration Tests
```typescript
// test/nodes.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('NodesController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/nodes (GET)', () => {
    return request(app.getHttpServer())
      .get('/nodes')
      .expect(200);
  });
});
```

## Migration Checklist

### Pre-Migration
- [ ] Backup current codebase
- [ ] Document all API endpoints
- [ ] Test current functionality thoroughly
- [ ] Set up feature flag for gradual rollout

### Phase 1: Foundation
- [ ] Install NestJS dependencies
- [ ] Create basic NestJS structure
- [ ] Set up Prisma module
- [ ] Configure environment variables

### Phase 2: Authentication
- [ ] Install Better Auth NestJS integration
- [ ] Configure authentication module
- [ ] Convert middleware to guards
- [ ] Test authentication flow

### Phase 3: API Layer
- [ ] Migrate auth routes
- [ ] Migrate nodes routes
- [ ] Migrate dependencies routes
- [ ] Migrate projects routes
- [ ] Migrate actions routes
- [ ] Migrate database admin routes

### Phase 4: Service Layer
- [ ] Convert dependency graph service
- [ ] Convert process service
- [ ] Convert CLI service
- [ ] Convert connection service

### Phase 5: Worker System
- [ ] Migrate worker thread pool
- [ ] Implement background job system
- [ ] Convert action execution

### Phase 6: Testing & Deployment
- [ ] Migrate all tests to Jest
- [ ] Set up CI/CD pipeline
- [ ] Perform integration testing
- [ ] Deploy to staging environment
- [ ] Monitor performance and errors

## Risk Mitigation

### Technical Risks
1. **Performance Impact**: NestJS adds abstraction layers
   - Mitigation: Use Fastify adapter, profile performance
2. **Authentication Compatibility**: Better Auth integration
   - Mitigation: Test thoroughly, have rollback plan
3. **Database Connection**: Prisma client lifecycle
   - Mitigation: Implement proper connection management

### Migration Risks
1. **API Breaking Changes**: Ensure backward compatibility
   - Mitigation: Run both servers in parallel during transition
2. **Testing Coverage**: Maintain test quality
   - Mitigation: Write comprehensive tests before migration
3. **Team Learning Curve**: NestJS adoption
   - Mitigation: Provide training and documentation

## Success Criteria

- All existing functionality preserved
- Performance equal to or better than Fastify
- 100% test coverage maintained
- Zero downtime during migration
- Team comfortable with NestJS patterns
- Improved code maintainability and scalability

## Timeline

- **Week 1-2**: Foundation and Authentication
- **Week 3-4**: API Layer Migration
- **Week 5**: Service Layer Migration
- **Week 6**: Worker System Migration
- **Week 7**: Testing and Deployment

Total Estimated Time: 7 weeks

## Post-Migration Benefits

1. **Better Architecture**: Clear separation of concerns
2. **Enhanced Testability**: Built-in testing utilities
3. **Scalability**: Modular architecture for growth
4. **Developer Experience**: CLI tools and code generation
5. **Ecosystem**: Rich plugin and middleware ecosystem
6. **Type Safety**: Improved TypeScript integration

This migration plan provides a structured approach to transitioning from Fastify to NestJS while maintaining all existing functionality and improving the overall architecture and maintainability of the codebase.