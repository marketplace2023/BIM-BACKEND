import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { ResUser } from '../database/entities/identity/res-user.entity';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { FurController } from './fur.controller';
import { FurService } from './fur.service';

@Module({
  imports: [TypeOrmModule.forFeature([ResPartner, ResUser, ProductTemplate])],
  controllers: [FurController],
  providers: [FurService, AdminRoleGuard],
  exports: [FurService],
})
export class FurModule {}
