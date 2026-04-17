import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';
import { ChangeDocumentStatusDto } from '../common/dto/change-document-status.dto';
import { ComputosService } from './computos.service';
import { CreateComputoDocumentoDto } from './dto/create-computo-documento.dto';
import { UpdateComputoDocumentoDto } from './dto/update-computo-documento.dto';
import { SaveComputoDetallesDto } from './dto/save-computo-detalles.dto';

@UseGuards(BimJwtGuard)
@Controller('computos')
export class ComputosController {
  constructor(private readonly computosService: ComputosService) {}

  @Get('obra/:obraId')
  findByObra(
    @Param('obraId') obraId: string,
    @Query('presupuestoId') presupuestoId: string | undefined,
    @Request() req: any,
  ) {
    return this.computosService.findByObra(
      obraId,
      req.user.tenant_id,
      presupuestoId,
    );
  }

  @Post('documentos')
  createDocumento(@Body() dto: CreateComputoDocumentoDto, @Request() req: any) {
    return this.computosService.createDocumento(
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }

  @Get('documentos/:id')
  findDocumento(@Param('id') id: string, @Request() req: any) {
    return this.computosService.findDocumento(id, req.user.tenant_id);
  }

  @Patch('documentos/:id')
  updateDocumento(
    @Param('id') id: string,
    @Body() dto: UpdateComputoDocumentoDto,
    @Request() req: any,
  ) {
    return this.computosService.updateDocumento(id, req.user.tenant_id, dto);
  }

  @Delete('documentos/:id')
  removeDocumento(@Param('id') id: string, @Request() req: any) {
    return this.computosService.removeDocumento(id, req.user.tenant_id);
  }

  @Get('documentos/:id/resumen')
  getDocumentoResumen(@Param('id') id: string, @Request() req: any) {
    return this.computosService.getDocumentoResumen(id, req.user.tenant_id);
  }

  @Patch('documentos/:id/detalles')
  saveDocumentoDetalles(
    @Param('id') id: string,
    @Body() dto: SaveComputoDetallesDto,
    @Request() req: any,
  ) {
    return this.computosService.saveDocumentoDetalles(
      id,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
      dto,
    );
  }

  @Post('documentos/:id/sync-presupuesto')
  syncPresupuesto(@Param('id') id: string, @Request() req: any) {
    return this.computosService.syncDocumentoToPresupuesto(id, req.user.tenant_id);
  }

  @Patch('documentos/:id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeDocumentStatusDto,
    @Request() req: any,
  ) {
    return this.computosService.changeStatus(
      id,
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }
}
