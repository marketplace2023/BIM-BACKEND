import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { BimUser } from '../database/entities/bim/bim-user.entity';
import { Tenant } from '../database/entities/core/tenant.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { ResUser } from '../database/entities/identity/res-user.entity';
import { UserRole } from '../database/entities/identity/user-role.entity';
import { UserRoleAssignment } from '../database/entities/identity/user-role-assignment.entity';
import { BimAdminService } from './bim-admin.service';
import { BimAdminController } from './bim-admin.controller';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      BimUser,
      Tenant,
      ResUser,
      ResPartner,
      UserRole,
      UserRoleAssignment,
    ]),
    // JwtModule sin secreto fijo — el secreto se lee dinámicamente en BimJwtGuard y BimAdminService
    JwtModule.register({}),
  ],
  controllers: [BimAdminController],
  providers: [BimAdminService, BimJwtGuard],
  exports: [BimAdminService, BimJwtGuard, JwtModule],
})
export class BimAdminModule {}
