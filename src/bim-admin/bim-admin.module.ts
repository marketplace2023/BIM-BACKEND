import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { BimUser } from '../database/entities/bim/bim-user.entity';
import { Tenant } from '../database/entities/core/tenant.entity';
import { ResUser } from '../database/entities/identity/res-user.entity';
import { BimAdminService } from './bim-admin.service';
import { BimAdminController } from './bim-admin.controller';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([BimUser, Tenant, ResUser]),
    // JwtModule sin secreto fijo — el secreto se lee dinámicamente en BimJwtGuard y BimAdminService
    JwtModule.register({}),
  ],
  controllers: [BimAdminController],
  providers: [BimAdminService, BimJwtGuard],
  exports: [BimAdminService, BimJwtGuard, JwtModule],
})
export class BimAdminModule {}
