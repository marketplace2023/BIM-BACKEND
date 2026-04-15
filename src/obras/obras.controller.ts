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
} from '@nestjs/common';
import { ObrasService } from './obras.service';
import { CreateObraDto } from './dto/create-obra.dto';
import { UpdateObraDto } from './dto/update-obra.dto';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';

@UseGuards(BimJwtGuard)
@Controller('obras')
export class ObrasController {
  constructor(private readonly obrasService: ObrasService) {}

  @Post()
  create(@Body() dto: CreateObraDto, @Request() req: any) {
    return this.obrasService.create(
      dto,
      req.user.platform_user_id ?? req.user.id,
      req.user.tenant_id,
    );
  }

  @Get()
  findAll(@Query('estado') estado?: string, @Request() req?: any) {
    return this.obrasService.findAll(req.user.tenant_id, estado);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.obrasService.findOne(id, req.user.tenant_id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateObraDto,
    @Request() req: any,
  ) {
    return this.obrasService.update(id, req.user.tenant_id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.obrasService.remove(id, req.user.tenant_id);
  }
}
