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
import { CreateMedicionDocumentoDto } from './dto/create-medicion-documento.dto';
import { UpdateMedicionDocumentoDto } from './dto/update-medicion-documento.dto';
import { SaveMedicionDetallesDto } from './dto/save-medicion-detalles.dto';
import { MedicionesService } from './mediciones.service';

@UseGuards(BimJwtGuard)
@Controller('mediciones')
export class MedicionesController {
  constructor(private readonly medicionesService: MedicionesService) {}

  @Get('obra/:obraId')
  findByObra(
    @Param('obraId') obraId: string,
    @Query('presupuestoId') presupuestoId: string | undefined,
    @Request() req: any,
  ) {
    return this.medicionesService.findByObra(
      obraId,
      req.user.tenant_id,
      presupuestoId,
    );
  }

  @Post('documentos')
  createDocumento(@Body() dto: CreateMedicionDocumentoDto, @Request() req: any) {
    return this.medicionesService.createDocumento(
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }

  @Get('documentos/:id')
  findDocumento(@Param('id') id: string, @Request() req: any) {
    return this.medicionesService.findDocumento(id, req.user.tenant_id);
  }

  @Patch('documentos/:id')
  updateDocumento(
    @Param('id') id: string,
    @Body() dto: UpdateMedicionDocumentoDto,
    @Request() req: any,
  ) {
    return this.medicionesService.updateDocumento(id, req.user.tenant_id, dto);
  }

  @Delete('documentos/:id')
  removeDocumento(@Param('id') id: string, @Request() req: any) {
    return this.medicionesService.removeDocumento(id, req.user.tenant_id);
  }

  @Get('documentos/:id/resumen')
  getDocumentoResumen(@Param('id') id: string, @Request() req: any) {
    return this.medicionesService.getDocumentoResumen(id, req.user.tenant_id);
  }

  @Patch('documentos/:id/detalles')
  saveDocumentoDetalles(
    @Param('id') id: string,
    @Body() dto: SaveMedicionDetallesDto,
    @Request() req: any,
  ) {
    return this.medicionesService.saveDocumentoDetalles(
      id,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
      dto,
    );
  }

  @Patch('documentos/:id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeDocumentStatusDto,
    @Request() req: any,
  ) {
    return this.medicionesService.changeStatus(
      id,
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }
}
