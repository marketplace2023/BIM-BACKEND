import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BimAdminService } from './bim-admin.service';
import {
  CreateBimUserDto,
  UpdateBimUserDto,
  BimLoginDto,
} from './dto/bim-user.dto';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';

@Controller('bim-admin')
export class BimAdminController {
  constructor(private readonly service: BimAdminService) {}

  // Público — login del panel BIM
  @Post('auth/login')
  login(@Body() dto: BimLoginDto) {
    return this.service.login(dto);
  }

  // Protegido — gestión de usuarios BIM
  @UseGuards(BimJwtGuard)
  @Post('usuarios')
  createUser(@Body() dto: CreateBimUserDto) {
    return this.service.createUser(dto);
  }

  @UseGuards(BimJwtGuard)
  @Get('usuarios')
  findUsers() {
    return this.service.findUsers();
  }

  @UseGuards(BimJwtGuard)
  @Get('usuarios/:id')
  findUser(@Param('id') id: string) {
    return this.service.findUser(id);
  }

  @UseGuards(BimJwtGuard)
  @Patch('usuarios/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateBimUserDto) {
    return this.service.updateUser(id, dto);
  }

  @UseGuards(BimJwtGuard)
  @Delete('usuarios/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeUser(@Param('id') id: string) {
    return this.service.removeUser(id);
  }
}
