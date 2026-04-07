import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductPublicCategory } from '../database/entities/catalog/product-public-category.entity';
import { WebsiteFilter } from '../database/entities/catalog/website-filter.entity';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductPublicCategory, WebsiteFilter])],
  controllers: [CategoriesController],
  providers: [CategoriesService, AdminRoleGuard],
  exports: [CategoriesService],
})
export class CategoriesModule {}
