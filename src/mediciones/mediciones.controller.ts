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
import { CreateMedicionDto } from './dto/create-medicion.dto';
import { UpdateMedicionDto } from './dto/update-medicion.dto';
import { MedicionesService } from './mediciones.service';

@UseGuards(BimJwtGuard)
@Controller('mediciones')
export class MedicionesController {
  constructor(private readonly medicionesService: MedicionesService) {}

  @Post()
  create(@Body() dto: CreateMedicionDto, @Request() req: any) {
    return this.medicionesService.create(
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }

  @Get('obra/:obraId')
  findByObra(@Param('obraId') obraId: string, @Request() req: any) {
    return this.medicionesService.findByObra(obraId, req.user.tenant_id);
  }

  @Get('partida/:partidaId')
  findByPartida(@Param('partidaId') partidaId: string, @Request() req: any) {
    return this.medicionesService.findByPartida(partidaId, req.user.tenant_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.medicionesService.findOne(id, req.user.tenant_id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMedicionDto,
    @Request() req: any,
  ) {
    return this.medicionesService.update(id, req.user.tenant_id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.medicionesService.remove(id, req.user.tenant_id);
  }
}
