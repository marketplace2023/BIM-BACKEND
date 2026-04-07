import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private svc: UsersService) {}

  /** GET /api/users/me */
  @Get('me')
  findMe(@CurrentUser() user: { id: string }) {
    return this.svc.findMe(user.id);
  }

  /** PATCH /api/users/me */
  @Patch('me')
  updateMe(
    @CurrentUser() user: { id: string; partner_id: string },
    @Body() dto: UpdateUserDto,
  ) {
    return this.svc.updateMe(user.id, user.partner_id, dto);
  }

  /** PATCH /api/users/me/password */
  @Patch('me/password')
  updatePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.svc.updatePassword(user.id, dto);
  }
}
