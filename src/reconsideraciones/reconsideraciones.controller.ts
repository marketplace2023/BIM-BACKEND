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
import { CreateReconsideracionDocumentoDto } from './dto/create-reconsideracion-documento.dto';
import { UpdateReconsideracionDocumentoDto } from './dto/update-reconsideracion-documento.dto';
import { SaveReconsideracionDetallesDto } from './dto/save-reconsideracion-detalles.dto';
import { ReconsideracionesService } from './reconsideraciones.service';

@UseGuards(BimJwtGuard)
@Controller('reconsideraciones')
export class ReconsideracionesController {
  constructor(
    private readonly reconsideracionesService: ReconsideracionesService,
  ) {}

  @Get('obra/:obraId')
  findByObra(
    @Param('obraId') obraId: string,
    @Query('tipo') tipo: string | undefined,
    @Query('presupuestoId') presupuestoId: string | undefined,
    @Request() req: any,
  ) {
    return this.reconsideracionesService.findByObra(
      obraId,
      req.user.tenant_id,
      tipo,
      presupuestoId,
    );
  }

  @Post('documentos')
  createDocumento(@Body() dto: CreateReconsideracionDocumentoDto, @Request() req: any) {
    return this.reconsideracionesService.createDocumento(
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }

  @Get('documentos/:id')
  findDocumento(@Param('id') id: string, @Request() req: any) {
    return this.reconsideracionesService.findDocumento(id, req.user.tenant_id);
  }

  @Patch('documentos/:id')
  updateDocumento(
    @Param('id') id: string,
    @Body() dto: UpdateReconsideracionDocumentoDto,
    @Request() req: any,
  ) {
    return this.reconsideracionesService.updateDocumento(id, req.user.tenant_id, dto);
  }

  @Delete('documentos/:id')
  removeDocumento(@Param('id') id: string, @Request() req: any) {
    return this.reconsideracionesService.removeDocumento(id, req.user.tenant_id);
  }

  @Get('documentos/:id/resumen')
  getDocumentoResumen(@Param('id') id: string, @Request() req: any) {
    return this.reconsideracionesService.getDocumentoResumen(id, req.user.tenant_id);
  }

  @Patch('documentos/:id/detalles')
  saveDocumentoDetalles(
    @Param('id') id: string,
    @Body() dto: SaveReconsideracionDetallesDto,
    @Request() req: any,
  ) {
    return this.reconsideracionesService.saveDocumentoDetalles(
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
    return this.reconsideracionesService.changeStatus(
      id,
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }
}
