import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CertificacionesService } from './certificaciones.service';
import {
  CreateCertificacionDto,
  AprobarCertificacionDto,
} from './dto/create-certificacion.dto';
import { SaveCertificacionDetallesDto } from './dto/save-certificacion-detalles.dto';
import { UpdateCertificacionDto } from './dto/update-certificacion.dto';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';

@UseGuards(BimJwtGuard)
@Controller('certificaciones')
export class CertificacionesController {
  constructor(private readonly service: CertificacionesService) {}

  @Post()
  create(@Body() dto: CreateCertificacionDto, @Request() req: any) {
    return this.service.create(
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }

  @Get('obra/:obraId')
  findByObra(
    @Param('obraId') obraId: string,
    @Request() req: any,
    @Query('presupuestoId') presupuestoId?: string,
  ) {
    return this.service.findByObra(
      obraId,
      req.user.tenant_id,
      presupuestoId,
    );
  }

  @Get(':id/resumen')
  getResumen(@Param('id') id: string, @Request() req: any) {
    return this.service.getResumen(id, req.user.tenant_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user.tenant_id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCertificacionDto,
    @Request() req: any,
  ) {
    return this.service.update(id, req.user.tenant_id, dto);
  }

  @Patch(':id/detalles')
  saveDetalles(
    @Param('id') id: string,
    @Body() dto: SaveCertificacionDetallesDto,
    @Request() req: any,
  ) {
    return this.service.saveDetalles(id, req.user.tenant_id, dto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: AprobarCertificacionDto,
    @Request() req: any,
  ) {
    return this.service.cambiarEstado(
      id,
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.tenant_id);
  }
}
