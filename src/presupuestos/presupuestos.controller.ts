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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PresupuestosService } from './presupuestos.service';
import {
  CreatePresupuestoDto,
  CreateCapituloDto,
  CreatePartidaDto,
  CreatePartidaMaterialDto,
} from './dto/create-presupuesto.dto';
import {
  UpdatePresupuestoDto,
  UpdateCapituloDto,
  UpdatePartidaDto,
  UpdatePartidaMaterialDto,
} from './dto/update-presupuesto.dto';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';

@UseGuards(BimJwtGuard)
@Controller('presupuestos')
export class PresupuestosController {
  constructor(private readonly presupuestosService: PresupuestosService) {}

  // ── Presupuestos ─────────────────────────────────────
  @Post()
  create(@Body() dto: CreatePresupuestoDto, @Request() req: any) {
    return this.presupuestosService.create(
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }

  @Get('obra/:obraId')
  findByObra(
    @Param('obraId') obraId: string,
    @Query('tipo') tipo: string | undefined,
    @Request() req: any,
  ) {
    return this.presupuestosService.findByObra(obraId, req.user.tenant_id, tipo);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.findOne(id, req.user.tenant_id);
  }

  @Get(':id/arbol')
  findWithTree(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.findWithTree(id, req.user.tenant_id);
  }

  @Get(':id/pdf')
  async printPdf(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.presupuestosService.generatePdf(
      id,
      req.user.tenant_id,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePresupuestoDto,
    @Request() req: any,
  ) {
    return this.presupuestosService.update(id, req.user.tenant_id, dto);
  }

  @Patch(':id/aprobar')
  aprobar(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.aprobar(
      id,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }

  @Patch(':id/borrador')
  devolverABorrador(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.devolverABorrador(id, req.user.tenant_id);
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
  updateCapitulo(
    @Param('id') id: string,
    @Body() dto: UpdateCapituloDto,
    @Request() req: any,
  ) {
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
    return this.presupuestosService.createPartida(
      capituloId,
      req.user.tenant_id,
      dto,
    );
  }

  @Patch('partidas/:id')
  updatePartida(
    @Param('id') id: string,
    @Body() dto: UpdatePartidaDto,
    @Request() req: any,
  ) {
    return this.presupuestosService.updatePartida(id, req.user.tenant_id, dto);
  }

  @Delete('partidas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePartida(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.removePartida(id, req.user.tenant_id);
  }

  @Get('partidas/:id/materiales')
  findPartidaMateriales(
    @Param('id') id: string,
    @Query('tipo') tipo: string | undefined,
    @Request() req: any,
  ) {
    return this.presupuestosService.findPartidaMateriales(id, req.user.tenant_id, tipo);
  }

  @Post('partidas/:id/materiales')
  createPartidaMaterial(
    @Param('id') id: string,
    @Body() dto: CreatePartidaMaterialDto,
    @Request() req: any,
  ) {
    return this.presupuestosService.createPartidaMaterial(id, req.user.tenant_id, dto);
  }

  @Patch('partidas/materiales/:id')
  updatePartidaMaterial(
    @Param('id') id: string,
    @Body() dto: UpdatePartidaMaterialDto,
    @Request() req: any,
  ) {
    return this.presupuestosService.updatePartidaMaterial(id, req.user.tenant_id, dto);
  }

  @Delete('partidas/materiales/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePartidaMaterial(@Param('id') id: string, @Request() req: any) {
    return this.presupuestosService.removePartidaMaterial(id, req.user.tenant_id);
  }
}
