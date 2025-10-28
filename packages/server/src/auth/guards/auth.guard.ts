import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { auth } from '../auth.config';
import { info } from '../../logging';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    try {
      const apiKey = request.headers['dms-key'];

      if (typeof apiKey === 'string') {
        info('Api key detected, start validating....');
        const data = await auth.api.verifyApiKey({
          body: {
            key: apiKey,
          },
        });

        if (data.valid) {
          return true;
        }

        throw new UnauthorizedException('Invalid or expired apiKey');
      }

      const session = await auth.api.getSession({
        headers: request.headers
      });

      if (!session || !session.user) {
        throw new UnauthorizedException('Invalid or expired session');
      }

      // Check if user is banned
      if (session.user.banned) {
        throw new ForbiddenException('Your account has been banned');
      }

      // Attach user and session to request
      request.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name || undefined,
        role: session.user.role || 'user',
        banned: session.user.banned || false
      };
      request.session = {
        id: session.session.id,
        userId: session.session.userId,
        expiresAt: session.session.expiresAt
      };

      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }
}