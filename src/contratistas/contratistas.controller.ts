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
import { ContratistasService } from './contratistas.service';
import { CreateContratistaDto } from './dto/create-contratista.dto';
import { UpdateContratistaDto } from './dto/update-contratista.dto';
import { AsignarContratistaDto } from './dto/asignar-contratista.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('contratistas')
export class ContratistasController {
  constructor(private readonly contratistasService: ContratistasService) {}

  @Post()
  create(@Body() dto: CreateContratistaDto) {
    return this.contratistasService.create(dto);
  }

  @Get()
  findAll(@Query('estado') estado?: string) {
    return this.contratistasService.findAll(estado);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contratistasService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContratistaDto) {
    return this.contratistasService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.contratistasService.remove(id);
  }

  // ── Endpoints de asignación a obra ──────────────────────
  @Post('obras/:obraId/contratistas')
  asignarAObra(
    @Param('obraId') obraId: string,
    @Body() dto: AsignarContratistaDto,
  ) {
    return this.contratistasService.asignarAObra(obraId, dto);
  }

  @Get('obras/:obraId/contratistas')
  findByObra(@Param('obraId') obraId: string) {
    return this.contratistasService.findByObra(obraId);
  }

  @Delete('obras/:obraId/contratistas/:contratistaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  desasignarDeObra(
    @Param('obraId') obraId: string,
    @Param('contratistaId') contratistaId: string,
  ) {
    return this.contratistasService.desasignarDeObra(obraId, contratistaId);
  }
}
