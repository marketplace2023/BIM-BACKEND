import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';
import { CreateReconsideracionDto } from './dto/create-reconsideracion.dto';
import { UpdateReconsideracionDto } from './dto/update-reconsideracion.dto';
import { ChangeReconsideracionStatusDto } from './dto/change-reconsideracion-status.dto';
import { ReconsideracionesService } from './reconsideraciones.service';

@UseGuards(BimJwtGuard)
@Controller('reconsideraciones')
export class ReconsideracionesController {
  constructor(
    private readonly reconsideracionesService: ReconsideracionesService,
  ) {}

  @Post()
  create(@Body() dto: CreateReconsideracionDto, @Request() req: any) {
    return this.reconsideracionesService.create(
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }

  @Get('obra/:obraId')
  findByObra(@Param('obraId') obraId: string, @Request() req: any) {
    return this.reconsideracionesService.findByObra(obraId, req.user.tenant_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.reconsideracionesService.findOne(id, req.user.tenant_id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReconsideracionDto,
    @Request() req: any,
  ) {
    return this.reconsideracionesService.update(id, req.user.tenant_id, dto);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeReconsideracionStatusDto,
    @Request() req: any,
  ) {
    return this.reconsideracionesService.changeStatus(
      id,
      req.user.tenant_id,
      req.user.platform_user_id ?? req.user.id,
      dto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.reconsideracionesService.remove(id, req.user.tenant_id);
  }
}
