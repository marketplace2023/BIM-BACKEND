import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private svc: AuthService) {}

  /** POST /api/auth/register */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.svc.register(dto);
  }

  /** POST /api/auth/login */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.svc.login(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.svc.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.svc.resetPassword(dto);
  }

  /** GET /api/auth/me */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.svc.getProfile(user.id);
  }
}
