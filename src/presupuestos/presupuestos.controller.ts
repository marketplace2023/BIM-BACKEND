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
    return this.presupuestosService.create(dto, req.user.id, req.user.tenant_id);
  }

  @Get('obra/:obraId')
  findByObra(@Param('obraId') obraId: string, @Request() req: any) {
    return this.presupuestosService.findByObra(obraId, req.user.tenant_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.findOne(id, req.user.tenant_id);
  }

  @Get(':id/arbol')
  findWithTree(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.findWithTree(id, req.user.tenant_id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePresupuestoDto, @Request() req: any) {
    return this.presupuestosService.update(id, req.user.tenant_id, dto);
  }

  @Patch(':id/aprobar')
  aprobar(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.aprobar(id, req.user.id, req.user.tenant_id);
  }

  @Patch(':id/recalcular')
  recalcular(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.recalcularTotal(id, req.user.tenant_id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.remove(id, req.user.tenant_id);
  }

  // ── Capítulos ─────────────────────────────────────────
  @Post(':presupuestoId/capitulos')
  createCapitulo(
    @Param('presupuestoId') presupuestoId: string,
    @Body() dto: CreateCapituloDto,
    @Request() req: any,
  ) {
    return this.presupuestosService.createCapitulo(
      presupuestoId,
      req.user.tenant_id,
      dto,
    );
  }

  @Patch('capitulos/:id')
  updateCapitulo(@Param('id') id: string, @Body() dto: UpdateCapituloDto, @Request() req: any) {
    return this.presupuestosService.updateCapitulo(id, req.user.tenant_id, dto);
  }

  @Delete('capitulos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCapitulo(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.removeCapitulo(id, req.user.tenant_id);
  }

  // ── Partidas ──────────────────────────────────────────
  @Post('capitulos/:capituloId/partidas')
  createPartida(
    @Param('capituloId') capituloId: string,
    @Body() dto: CreatePartidaDto,
    @Request() req: any,
  ) {
    return this.presupuestosService.createPartida(capituloId, req.user.tenant_id, dto);
  }

  @Patch('partidas/:id')
  updatePartida(@Param('id') id: string, @Body() dto: UpdatePartidaDto, @Request() req: any) {
    return this.presupuestosService.updatePartida(id, req.user.tenant_id, dto);
  }

  @Delete('partidas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePartida(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.removePartida(id, req.user.tenant_id);
  }
}
