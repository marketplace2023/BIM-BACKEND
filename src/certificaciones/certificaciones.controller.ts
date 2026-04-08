import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('certificaciones')
export class CertificacionesController {
  constructor(private readonly service: CertificacionesService) {}

  @Post()
  create(@Body() dto: CreateCertificacionDto, @Request() req: any) {
    return this.service.create(dto, req.user.id, req.user.tenant_id);
  }

  @Get('obra/:obraId')
  findByObra(@Param('obraId') obraId: string, @Request() req: any) {
    return this.service.findByObra(obraId, req.user.tenant_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user.tenant_id);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: AprobarCertificacionDto,
    @Request() req: any,
  ) {
    return this.service.cambiarEstado(id, dto, req.user.id, req.user.tenant_id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.tenant_id);
  }
}
