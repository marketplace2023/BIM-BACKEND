import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { BimUser } from '../database/entities/bim/bim-user.entity';
import { BimAdminService } from './bim-admin.service';
import { BimAdminController } from './bim-admin.controller';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([BimUser]),
    // JwtModule sin secreto fijo — el secreto se lee dinámicamente en BimJwtGuard y BimAdminService
    JwtModule.register({}),
  ],
  controllers: [BimAdminController],
  providers: [BimAdminService, BimJwtGuard],
  exports: [BimAdminService, BimJwtGuard],
})
export class BimAdminModule {}
