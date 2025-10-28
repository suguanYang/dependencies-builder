import { Controller, Post, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { HasPermissionDto } from './dto/has-permission.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthGuard } from './guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('has-permission')
  @UseGuards(AuthGuard)
  async hasPermission(@Req() req: any, @Body() hasPermissionDto: HasPermissionDto) {
    return this.authService.hasPermission(req.user?.role, hasPermissionDto);
  }

  @Post('create-user')
  @UseGuards(AuthGuard)
  async createUser(@Req() req: any, @Body() createUserDto: CreateUserDto) {
    // Only allow admins to create users
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }

    return this.authService.createUser(createUserDto);
  }
}