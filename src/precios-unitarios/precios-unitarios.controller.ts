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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('precios-unitarios')
export class PreciosUnitariosController {
  constructor(private readonly service: PreciosUnitariosService) {}

  // ── Recursos ─────────────────────────────────────────
  @Post('recursos')
  createRecurso(@Body() dto: CreateRecursoDto) {
    return this.service.createRecurso(dto);
  }

  @Get('recursos')
  findRecursos(@Query('tipo') tipo?: string) {
    return this.service.findRecursos(tipo);
  }

  @Patch('recursos/:id')
  updateRecurso(@Param('id') id: string, @Body() dto: UpdateRecursoDto) {
    return this.service.updateRecurso(id, dto);
  }

  @Delete('recursos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRecurso(@Param('id') id: string) {
    return this.service.removeRecurso(id);
  }

  // ── APU (Precios Unitarios) ───────────────────────────
  @Post()
  createPU(@Body() dto: CreatePrecioUnitarioDto) {
    return this.service.createPU(dto);
  }

  @Get()
  findPUs(@Query('categoria') categoria?: string) {
    return this.service.findPUs(categoria);
  }

  @Get(':id')
  findOnePU(@Param('id') id: string) {
    return this.service.findOnePU(id);
  }

  @Patch(':id')
  updatePU(@Param('id') id: string, @Body() dto: UpdatePrecioUnitarioDto) {
    return this.service.updatePU(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePU(@Param('id') id: string) {
    return this.service.removePU(id);
  }

  // ── Descomposición del APU ────────────────────────────
  @Post(':id/descomposicion')
  addDescomposicion(
    @Param('id') id: string,
    @Body() dto: CreateDescomposicionDto,
  ) {
    return this.service.addDescomposicion(id, dto);
  }

  @Patch('descomposicion/:id')
  updateDescomposicion(
    @Param('id') id: string,
    @Body() dto: UpdateDescomposicionDto,
  ) {
    return this.service.updateDescomposicion(id, dto);
  }

  @Delete('descomposicion/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDescomposicion(@Param('id') id: string) {
    return this.service.removeDescomposicion(id);
  }
}
