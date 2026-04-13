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
import { ContratistasService } from './contratistas.service';
import { CreateContratistaDto } from './dto/create-contratista.dto';
import { UpdateContratistaDto } from './dto/update-contratista.dto';
import { AsignarContratistaDto } from './dto/asignar-contratista.dto';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';

@UseGuards(BimJwtGuard)
@Controller('contratistas')
export class ContratistasController {
  constructor(private readonly contratistasService: ContratistasService) {}

  @Post()
  create(@Body() dto: CreateContratistaDto, @Request() req: any) {
    return this.contratistasService.create(dto, req.user.tenant_id);
  }

  @Get()
  findAll(@Query('estado') estado?: string, @Request() req?: any) {
    return this.contratistasService.findAll(req.user.tenant_id, estado);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.contratistasService.findOne(id, req.user.tenant_id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContratistaDto, @Request() req: any) {
    return this.contratistasService.update(id, req.user.tenant_id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.contratistasService.remove(id, req.user.tenant_id);
  }

  // ── Endpoints de asignación a obra ──────────────────────
  @Post('obras/:obraId/contratistas')
  asignarAObra(
    @Param('obraId') obraId: string,
    @Body() dto: AsignarContratistaDto,
    @Request() req: any,
  ) {
    return this.contratistasService.asignarAObra(obraId, dto, req.user.tenant_id);
  }

  @Get('obras/:obraId/contratistas')
  findByObra(@Param('obraId') obraId: string, @Request() req: any) {
    return this.contratistasService.findByObra(obraId, req.user.tenant_id);
  }

  @Delete('obras/:obraId/contratistas/:contratistaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  desasignarDeObra(
    @Param('obraId') obraId: string,
    @Param('contratistaId') contratistaId: string,
    @Request() req: any,
  ) {
    return this.contratistasService.desasignarDeObra(
      obraId,
      contratistaId,
      req.user.tenant_id,
    );
  }
}
