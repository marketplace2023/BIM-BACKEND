import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';
import { ComputosService } from './computos.service';
import { CreateComputoDto } from './dto/create-computo.dto';
import { UpdateComputoDto } from './dto/update-computo.dto';

@UseGuards(BimJwtGuard)
@Controller('computos')
export class ComputosController {
  constructor(private readonly computosService: ComputosService) {}

  @Post()
  create(@Body() dto: CreateComputoDto, @Request() req: any) {
    return this.computosService.create(
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }

  @Get('obra/:obraId')
  findByObra(@Param('obraId') obraId: string, @Request() req: any) {
    return this.computosService.findByObra(obraId, req.user.tenant_id);
  }

  @Get('partida/:partidaId')
  findByPartida(@Param('partidaId') partidaId: string, @Request() req: any) {
    return this.computosService.findByPartida(partidaId, req.user.tenant_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.computosService.findOne(id, req.user.tenant_id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateComputoDto,
    @Request() req: any,
  ) {
    return this.computosService.update(id, req.user.tenant_id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.computosService.remove(id, req.user.tenant_id);
  }
}
