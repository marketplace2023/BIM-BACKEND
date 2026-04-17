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
import { CreateMemoriaDto } from './dto/create-memoria.dto';
import { UpdateMemoriaDto } from './dto/update-memoria.dto';
import { MemoriasService } from './memorias.service';

@UseGuards(BimJwtGuard)
@Controller('memorias')
export class MemoriasController {
  constructor(private readonly memoriasService: MemoriasService) {}

  @Get('obra/:obraId')
  findByObra(
    @Param('obraId') obraId: string,
    @Query('presupuestoId') presupuestoId: string | undefined,
    @Request() req: any,
  ) {
    return this.memoriasService.findByObra(obraId, req.user.tenant_id, presupuestoId)
  }

  @Post()
  create(@Body() dto: CreateMemoriaDto, @Request() req: any) {
    return this.memoriasService.create(
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    )
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.memoriasService.findOne(id, req.user.tenant_id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMemoriaDto, @Request() req: any) {
    return this.memoriasService.update(id, req.user.tenant_id, dto)
  }

  @Patch(':id/status')
  changeStatus(@Param('id') id: string, @Body() dto: ChangeDocumentStatusDto, @Request() req: any) {
    return this.memoriasService.changeStatus(
      id,
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    )
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.memoriasService.remove(id, req.user.tenant_id)
  }
}
