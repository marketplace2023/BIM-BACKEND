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
import { PresupuestosService } from './presupuestos.service';
import {
  CreatePresupuestoDto,
  CreateCapituloDto,
  CreatePartidaDto,
} from './dto/create-presupuesto.dto';
import {
  UpdatePresupuestoDto,
  UpdateCapituloDto,
  UpdatePartidaDto,
} from './dto/update-presupuesto.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('presupuestos')
export class PresupuestosController {
  constructor(private readonly presupuestosService: PresupuestosService) {}

  // ── Presupuestos ─────────────────────────────────────
  @Post()
  create(@Body() dto: CreatePresupuestoDto, @Request() req: any) {
    return this.presupuestosService.create(dto, req.user.id);
  }

  @Get('obra/:obraId')
  findByObra(@Param('obraId') obraId: string) {
    return this.presupuestosService.findByObra(obraId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.presupuestosService.findOne(id);
  }

  @Get(':id/arbol')
  findWithTree(@Param('id') id: string) {
    return this.presupuestosService.findWithTree(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePresupuestoDto) {
    return this.presupuestosService.update(id, dto);
  }

  @Patch(':id/aprobar')
  aprobar(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.aprobar(id, req.user.id);
  }

  @Patch(':id/recalcular')
  recalcular(@Param('id') id: string) {
    return this.presupuestosService.recalcularTotal(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.presupuestosService.remove(id);
  }

  // ── Capítulos ─────────────────────────────────────────
  @Post(':presupuestoId/capitulos')
  createCapitulo(
    @Param('presupuestoId') presupuestoId: string,
    @Body() dto: CreateCapituloDto,
  ) {
    return this.presupuestosService.createCapitulo(presupuestoId, dto);
  }

  @Patch('capitulos/:id')
  updateCapitulo(@Param('id') id: string, @Body() dto: UpdateCapituloDto) {
    return this.presupuestosService.updateCapitulo(id, dto);
  }

  @Delete('capitulos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCapitulo(@Param('id') id: string) {
    return this.presupuestosService.removeCapitulo(id);
  }

  // ── Partidas ──────────────────────────────────────────
  @Post('capitulos/:capituloId/partidas')
  createPartida(
    @Param('capituloId') capituloId: string,
    @Body() dto: CreatePartidaDto,
  ) {
    return this.presupuestosService.createPartida(capituloId, dto);
  }

  @Patch('partidas/:id')
  updatePartida(@Param('id') id: string, @Body() dto: UpdatePartidaDto) {
    return this.presupuestosService.updatePartida(id, dto);
  }

  @Delete('partidas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePartida(@Param('id') id: string) {
    return this.presupuestosService.removePartida(id);
  }
}
