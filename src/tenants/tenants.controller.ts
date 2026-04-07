import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private svc: TenantsService) {}

  /** POST /api/tenants */
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.svc.create(dto);
  }

  /** GET /api/tenants */
  @Get()
  findAll() {
    return this.svc.findAll();
  }

  /** GET /api/tenants/:id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  /** PATCH /api/tenants/:id */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.svc.update(id, dto);
  }
}
