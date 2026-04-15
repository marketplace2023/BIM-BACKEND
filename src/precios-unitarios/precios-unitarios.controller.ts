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
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { PreciosUnitariosService } from './precios-unitarios.service';
import {
  CreatePrecioUnitarioDto,
  CreateRecursoDto,
  CreateDescomposicionDto,
} from './dto/create-precio-unitario.dto';
import {
  UpdatePrecioUnitarioDto,
  UpdateRecursoDto,
  UpdateDescomposicionDto,
} from './dto/update-precio-unitario.dto';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';

@UseGuards(BimJwtGuard)
@Controller('precios-unitarios')
export class PreciosUnitariosController {
  constructor(private readonly service: PreciosUnitariosService) {}

  // ── Recursos ─────────────────────────────────────────
  @Post('recursos')
  createRecurso(@Body() dto: CreateRecursoDto, @Request() req: any) {
    return this.service.createRecurso(dto, req.user.tenant_id);
  }

  @Get('recursos')
  findRecursos(@Query('tipo') tipo?: string, @Request() req?: any) {
    return this.service.findRecursos(req.user.tenant_id, tipo);
  }

  @Patch('recursos/:id')
  updateRecurso(
    @Param('id') id: string,
    @Body() dto: UpdateRecursoDto,
    @Request() req: any,
  ) {
    return this.service.updateRecurso(id, req.user.tenant_id, dto);
  }

  @Delete('recursos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRecurso(@Param('id') id: string, @Request() req: any) {
    return this.service.removeRecurso(id, req.user.tenant_id);
  }

  // ── APU (Precios Unitarios) ───────────────────────────
  @Post()
  createPU(@Body() dto: CreatePrecioUnitarioDto, @Request() req: any) {
    return this.service.createPU(dto, req.user.tenant_id);
  }

  @Get()
  findPUs(@Query('categoria') categoria?: string, @Request() req?: any) {
    return this.service.findPUs(req.user.tenant_id, categoria);
  }

  @Get(':id')
  findOnePU(@Param('id') id: string, @Request() req: any) {
    return this.service.findOnePU(id, req.user.tenant_id);
  }

  @Patch(':id')
  updatePU(
    @Param('id') id: string,
    @Body() dto: UpdatePrecioUnitarioDto,
    @Request() req: any,
  ) {
    return this.service.updatePU(id, req.user.tenant_id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePU(@Param('id') id: string, @Request() req: any) {
    return this.service.removePU(id, req.user.tenant_id);
  }

  // ── Descomposición del APU ────────────────────────────
  @Post(':id/descomposicion')
  addDescomposicion(
    @Param('id') id: string,
    @Body() dto: CreateDescomposicionDto,
    @Request() req: any,
  ) {
    return this.service.addDescomposicion(id, req.user.tenant_id, dto);
  }

  @Patch('descomposicion/:id')
  updateDescomposicion(
    @Param('id') id: string,
    @Body() dto: UpdateDescomposicionDto,
    @Request() req: any,
  ) {
    return this.service.updateDescomposicion(id, req.user.tenant_id, dto);
  }

  @Delete('descomposicion/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDescomposicion(@Param('id') id: string, @Request() req: any) {
    return this.service.removeDescomposicion(id, req.user.tenant_id);
  }
}
