import { Injectable, ForbiddenException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { auth } from './auth.config';
import { HasPermissionDto } from './dto/has-permission.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class AuthService {
  async hasPermission(userRole: string | undefined, hasPermissionDto: HasPermissionDto) {
    try {
      const { resource, action } = hasPermissionDto;

      // For now, we'll use role-based checking instead of the permission API
      // This is simpler and more reliable
      const hasPermission = userRole === 'admin' || action === 'read';

      return {
        hasPermission
      };
    } catch (error) {
      console.error('Permission check error:', error);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to check permission'
      });
    }
  }

  async createUser(createUserDto: CreateUserDto) {
    try {
      const { email, password, name } = createUserDto;

      const result = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name: name || ''
        }
      });

      // Check if there was an error in the response
      if (!result.user) {
        throw new BadRequestException('Failed to create user');
      }

      // For now, we'll return basic user info without role
      // The role will be set to 'user' by default in the database
      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name
        }
      };
    } catch (error) {
      console.error('Create user error:', error);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to create user'
      });
    }
  }
}