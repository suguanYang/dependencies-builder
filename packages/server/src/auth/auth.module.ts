import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    BetterAuthModule.forRoot({ auth }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [BetterAuthModule, AuthService],
})
export class AuthModule { }